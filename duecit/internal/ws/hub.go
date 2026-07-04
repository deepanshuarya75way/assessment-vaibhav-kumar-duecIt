package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/duecit/duecit/internal/auth"
	"github.com/duecit/duecit/internal/models"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Client struct {
	User   *models.User
	Conn   *websocket.Conn
	Send   chan []byte
	Hub    *Hub
	UserID string
}

type Hub struct {
	mu        sync.RWMutex
	clients   map[string]*Client
	rooms     map[string]map[string]*Client
	auth      *auth.Service
	onConnect func(userID string)
}

func (h *Hub) SetOnConnect(fn func(userID string)) {
	h.onConnect = fn
}

func NewHub(authSvc *auth.Service) *Hub {
	return &Hub{
		clients: make(map[string]*Client),
		rooms:   make(map[string]map[string]*Client),
		auth:    authSvc,
	}
}

type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

func (h *Hub) EmitToUser(userID string, eventType string, data interface{}) {
	h.mu.RLock()
	client, ok := h.clients[userID]
	h.mu.RUnlock()
	if !ok {
		return
	}
	payload, _ := json.Marshal(Event{Type: eventType, Data: data})
	select {
	case client.Send <- payload:
	default:
	}
}

func (h *Hub) EmitToMatch(matchID string, eventType string, data interface{}) {
	h.mu.RLock()
	room := h.rooms[matchID]
	h.mu.RUnlock()
	if room == nil {
		return
	}
	payload, _ := json.Marshal(Event{Type: eventType, Data: data})
	for _, c := range room {
		select {
		case c.Send <- payload:
		default:
		}
	}
}

func (h *Hub) JoinMatchRoom(userID, matchID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[matchID] == nil {
		h.rooms[matchID] = make(map[string]*Client)
	}
	if c, ok := h.clients[userID]; ok {
		h.rooms[matchID][userID] = c
	}
}

func (h *Hub) LeaveMatchRoom(userID, matchID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if room, ok := h.rooms[matchID]; ok {
		delete(room, userID)
		if len(room) == 0 {
			delete(h.rooms, matchID)
		}
	}
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "token required", http.StatusUnauthorized)
		return
	}
	user, err := auth.ParseWSToken(h.auth, token)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &Client{
		User:   user,
		Conn:   conn,
		Send:   make(chan []byte, 64),
		Hub:    h,
		UserID: user.ID.Hex(),
	}

	h.mu.Lock()
	if old, ok := h.clients[client.UserID]; ok {
		close(old.Send)
		old.Conn.Close()
	}
	h.clients[client.UserID] = client
	h.mu.Unlock()

	if h.onConnect != nil {
		h.onConnect(client.UserID)
	}

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.Hub.mu.Lock()
		delete(c.Hub.clients, c.UserID)
		c.Hub.mu.Unlock()
		c.Conn.Close()
	}()
	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (c *Client) writePump() {
	defer c.Conn.Close()
	for msg := range c.Send {
		if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("ws write error: %v", err)
			return
		}
	}
}
