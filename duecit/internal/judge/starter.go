package judge

import (
	"fmt"
	"strings"

	"github.com/duecit/duecit/internal/models"
)

// GenerateStarterCode produces the LeetCode-style stub shown in the
// practice-mode editor: correct function name, correct params (with types
// where the language needs them), empty body. Driven by the same
// InputSpec/Signature that WrapPracticeCode uses, so the stub the user
// sees and the call the wrapper makes never drift out of sync.
func GenerateStarterCode(spec []models.InputVar, sig models.FuncSignature, language string) string {
	switch language {
	case "python":
		return fmt.Sprintf("def %s(%s):\n    # write your logic here\n    pass\n",
			sig.FuncName, strings.Join(sig.Params, ", "))
	case "javascript":
		return fmt.Sprintf("function %s(%s) {\n    // write your logic here\n}\n",
			sig.FuncName, strings.Join(sig.Params, ", "))
	case "go":
		return fmt.Sprintf("func %s(%s) %s {\n\t// write your logic here\n}\n",
			sig.FuncName, goParamList(spec, sig), goType(sig.ReturnType))
	default:
		return ""
	}
}

// GenerateAllStarterCode builds the StarterCode map for every
// practice-supported language, ready to store on models.Problem.StarterCode.
//
// Keys are suffixed "_practice" (e.g. "python_practice") deliberately, not
// the bare language name. The frontend's loadStarterCode looks up
// `${lang}_practice` first and falls back to the bare `${lang}` key. If we
// wrote the bare key here, that fallback would hand the practice-only
// function stub to competitive mode too - wrong on both counts, since
// competitive expects a full program, not a bare function.
func GenerateAllStarterCode(spec []models.InputVar, sig models.FuncSignature) map[string]string {
	out := map[string]string{}
	for _, lang := range []string{"python", "javascript", "go"} {
		if code := GenerateStarterCode(spec, sig, lang); code != "" {
			out[lang+"_practice"] = code
		}
	}
	return out
}

// goParamList looks up each function param's declared type from InputSpec
// (matched by name), since FuncSignature only stores param names + one
// ReturnType. Untyped languages (python/js) don't need this.
func goParamList(spec []models.InputVar, sig models.FuncSignature) string {
	byName := map[string]models.ParamType{}
	for _, v := range spec {
		byName[v.Name] = v.Type
	}
	parts := make([]string, len(sig.Params))
	for i, p := range sig.Params {
		t, ok := byName[p]
		if !ok {
			t = models.TypeString // unknown param, safest fallback
		}
		parts[i] = fmt.Sprintf("%s %s", p, goType(t))
	}
	return strings.Join(parts, ", ")
}

func goType(t models.ParamType) string {
	switch t {
	case models.TypeInt:
		return "int"
	case models.TypeFloat:
		return "float64"
	case models.TypeBool:
		return "bool"
	case models.TypeString:
		return "string"
	case models.TypeIntArr:
		return "[]int"
	case models.TypeFloatArr:
		return "[]float64"
	case models.TypeStringArr:
		return "[]string"
	default:
		return "interface{}"
	}
}