package auth

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"strings"

	"github.com/duecit/duecit/internal/models"
)

func (s *Service) SendPasswordResetEmail(_ context.Context, user *models.User, resetURL string) error {
	if s.cfg.SMTPHost == "" || s.cfg.SMTPFrom == "" {
		log.Printf("password reset link for %s: %s", user.Email, resetURL)
		return nil
	}

	addr := net.JoinHostPort(s.cfg.SMTPHost, s.cfg.SMTPPort)
	var auth smtp.Auth
	if s.cfg.SMTPUser != "" || s.cfg.SMTPPass != "" {
		auth = smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPass, s.cfg.SMTPHost)
	}

	subject := "Reset your DuecIt password"
	body := fmt.Sprintf(
		"Hi %s,\r\n\r\nWe received a request to reset your DuecIt password.\r\n\r\nOpen this link to choose a new password:\r\n%s\r\n\r\nThis link expires soon. If you did not request a password reset, you can ignore this email.\r\n",
		user.Username,
		resetURL,
	)
	msg := strings.Join([]string{
		"From: " + s.cfg.SMTPFrom,
		"To: " + user.Email,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	if err := smtp.SendMail(addr, auth, s.cfg.SMTPFrom, []string{user.Email}, []byte(msg)); err != nil {
		log.Printf("password reset email failed for %s: %v", user.Email, err)
		return nil
	}
	return nil
}
