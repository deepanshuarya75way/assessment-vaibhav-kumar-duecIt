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
func GenerateAllStarterCode(spec []models.InputVar, sig models.FuncSignature) map[string]string {
	out := map[string]string{}
	for _, lang := range []string{"python", "javascript", "go"} {
		if code := GenerateStarterCode(spec, sig, lang); code != "" {
			out[lang] = code
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

// GenerateCompetitiveTemplate returns a generic, problem-agnostic syntax
// demo for competitive mode: how to read from stdin and write to stdout in
// this language, so a person isn't stuck guessing the exact incantation
// (this was the actual root cause of "my code isn't running" reports -
// competitive mode showed a fully blank editor with zero syntax reference).
// Deliberately NOT tailored to any specific problem's input format - same
// idea as HackerEarth's generic "Hi, name." boilerplate. Replace the demo
// lines with real logic.
func GenerateCompetitiveTemplate(language string) string {
	switch language {
	case "python":
		return `# Example I/O - replace with your logic:
# name = input()                    # Reading input from STDIN
# print('Hi, %s.' % name)           # Writing output to STDOUT

`
	case "javascript":
		return `// Example I/O - replace with your logic:
// const line = require('fs').readFileSync(0, 'utf8').trim();  // Reading input from STDIN
// console.log('Hi, ' + line + '.');                            // Writing output to STDOUT

`
	case "go":
		return `package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	reader := bufio.NewReader(os.Stdin)
	_ = reader

	// Example I/O - replace with your logic:
	// line, _ := reader.ReadString('\n')   // Reading input from STDIN
	// fmt.Println("Hi, " + line + ".")     // Writing output to STDOUT
}
`
	case "c":
		return `#include <stdio.h>

int main() {
    // Example I/O - replace with your logic:
    // int num;
    // scanf("%d", &num);                        // Reading input from STDIN
    // printf("Input number is %d.\n", num);     // Writing output to STDOUT

    return 0;
}
`
	case "cpp":
		return `#include <bits/stdc++.h>
using namespace std;

int main() {
    // Example I/O - replace with your logic:
    // int num;
    // cin >> num;                                         // Reading input from STDIN
    // cout << "Input number is " << num << endl;          // Writing output to STDOUT

    return 0;
}
`
	case "java":
		return `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        // Example I/O - replace with your logic:
        // String name = sc.nextLine();                 // Reading input from STDIN
        // System.out.println("Hi, " + name + ".");     // Writing output to STDOUT
    }
}
`
	default:
		return ""
	}
}

// AllCompetitiveTemplates builds the bare-language-key portion of a
// Problem.StarterCode map (e.g. "python", not "python_practice"). Only
// covers languages the judge actually runs (see languageMap in judge.go).
func AllCompetitiveTemplates() map[string]string {
	out := map[string]string{}
	for _, lang := range []string{"python", "javascript", "cpp", "java", "c", "go"} {
		if tmpl := GenerateCompetitiveTemplate(lang); tmpl != "" {
			out[lang] = tmpl
		}
	}
	return out
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