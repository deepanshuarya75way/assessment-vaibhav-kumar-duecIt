package judge

import (
	"fmt"
	"strings"

	"github.com/duecit/duecit/internal/models"
)

// SolutionPlaceholder is the token an admin's hand-written driver code must
// contain somewhere - the submitted code is spliced in at that exact spot,
// verbatim. Chosen to be valid to drop into a comment in every supported
// language without needing escaping.
const SolutionPlaceholder = "##SOLUTION##"

// BuildExecutable is the single entry point for turning submitted code into
// something the judge can actually run. Three-tier fallback, in order:
//
//  1. Hand-written driver (problem.DriverCode[language]) - full admin
//     control. The submitted code replaces SolutionPlaceholder verbatim.
//  2. Auto-generated wrapper from InputSpec/Signature (WrapPracticeCode) -
//     the no-hand-writing-required path from earlier.
//  3. Raw passthrough - the submitted code runs exactly as written, full
//     program, stdin/stdout. Same as if neither of the above were configured.
//
// This replaces the old mode-gated call in manager.go: there's no longer an
// "if practice" check there at all - call this unconditionally and let the
// problem's own configuration decide what happens.
func BuildExecutable(code, language string, driverCode map[string]string, spec []models.InputVar, sig models.FuncSignature) string {
	if driver, ok := driverCode[language]; ok && driver != "" {
		if strings.Contains(driver, SolutionPlaceholder) {
			return strings.Replace(driver, SolutionPlaceholder, code, 1)
		}
		// Driver configured but missing the placeholder - admin error, not
		// a reason to silently drop the submitted code. Append it below a
		// comment so it's at least visible in Piston's stderr/stdout for
		// debugging, rather than pretending the driver alone is a program.
		return driver + "\n\n" + commentPrefix(language) + " WARNING: driver code is missing " + SolutionPlaceholder + " - submitted code appended below, may not compile/run correctly\n" + code
	}

	if sig.FuncName != "" {
		return WrapPracticeCode(code, language, spec, sig)
	}

	return code
}

func commentPrefix(language string) string {
	switch language {
	case "python":
		return "#"
	default:
		return "//"
	}
}

// WrapPracticeCode wraps a user's "logic-only" function in the stdin/stdout
// boilerplate needed by Piston, so in practice mode the user only writes
// the algorithm - not the I/O scaffolding.
//
// Unlike the old convention-based wrapper (fixed zero-arg solve(), fixed
// helper names), this one is driven entirely by the problem's own
// InputSpec (how to parse stdin) and Signature (what to call). Whatever
// function name/params a problem declares, the wrapper reads stdin in the
// declared order and calls exactly that function with exactly those args.
//
// For any language without a case below, the code runs unwrapped - same
// as competitive mode - so nothing silently breaks for unsupported langs.
func WrapPracticeCode(userCode string, language string, spec []models.InputVar, sig models.FuncSignature) string {
	switch language {
	case "python":
		return wrapPython(userCode, spec, sig)
	case "javascript":
		return wrapJS(userCode, spec, sig)
	case "go":
		return wrapGo(userCode, spec, sig)
	case "java":
		return wrapJava(userCode, spec, sig)
	case "cpp":
		return wrapCPP(userCode, spec, sig)
	case "c":
		return wrapC(userCode, spec, sig)
	default:
		return userCode
	}
}

func wrapPython(userCode string, spec []models.InputVar, sig models.FuncSignature) string {
	var reads strings.Builder
	for _, v := range spec {
		switch v.Type {
		case models.TypeInt:
			fmt.Fprintf(&reads, "%s = int(_readline())\n", v.Name)
		case models.TypeFloat:
			fmt.Fprintf(&reads, "%s = float(_readline())\n", v.Name)
		case models.TypeBool:
			fmt.Fprintf(&reads, "%s = _readline().strip().lower() in ('true', '1', 'yes')\n", v.Name)
		case models.TypeString:
			fmt.Fprintf(&reads, "%s = _readline()\n", v.Name)
		case models.TypeIntArr:
			fmt.Fprintf(&reads, "%s = list(map(int, _readline().split()))\n", v.Name)
		case models.TypeFloatArr:
			fmt.Fprintf(&reads, "%s = list(map(float, _readline().split()))\n", v.Name)
		case models.TypeStringArr:
			fmt.Fprintf(&reads, "%s = _readline().split()\n", v.Name)
		}
	}

	callArgs := strings.Join(sig.Params, ", ")

	return fmt.Sprintf(`import sys
_input_lines = sys.stdin.read().strip().split('\n')
_ptr = [0]

def _readline():
    line = _input_lines[_ptr[0]] if _ptr[0] < len(_input_lines) else ''
    _ptr[0] += 1
    return line.strip()

# ---- user code ----
%s
# ---- end user code ----

%s
_result = %s(%s)
if _result is not None:
    if isinstance(_result, (list, tuple)):
        print(' '.join(str(x) for x in _result))
    else:
        print(_result)
`, userCode, reads.String(), sig.FuncName, callArgs)
}

func wrapJS(userCode string, spec []models.InputVar, sig models.FuncSignature) string {
	var reads strings.Builder
	for _, v := range spec {
		switch v.Type {
		case models.TypeInt:
			fmt.Fprintf(&reads, "const %s = parseInt(_readline(), 10);\n", v.Name)
		case models.TypeFloat:
			fmt.Fprintf(&reads, "const %s = parseFloat(_readline());\n", v.Name)
		case models.TypeBool:
			fmt.Fprintf(&reads, "const %s = ['true', '1', 'yes'].includes(_readline().trim().toLowerCase());\n", v.Name)
		case models.TypeString:
			fmt.Fprintf(&reads, "const %s = _readline();\n", v.Name)
		case models.TypeIntArr, models.TypeFloatArr:
			fmt.Fprintf(&reads, "const %s = _readline().split(/\\s+/).filter(Boolean).map(Number);\n", v.Name)
		case models.TypeStringArr:
			fmt.Fprintf(&reads, "const %s = _readline().split(/\\s+/).filter(Boolean);\n", v.Name)
		}
	}

	callArgs := strings.Join(sig.Params, ", ")

	return fmt.Sprintf(`const _lines = require('fs').readFileSync(0, 'utf8').trim().split('\n');
let _ptr = 0;
const _readline = () => (_lines[_ptr++] || '').trim();

// ---- user code ----
%s
// ---- end user code ----

%s
const _result = %s(%s);
if (_result !== undefined && _result !== null) {
    if (Array.isArray(_result)) {
        process.stdout.write(_result.join(' ') + '\n');
    } else {
        process.stdout.write(String(_result) + '\n');
    }
}
`, userCode, reads.String(), sig.FuncName, callArgs)
}

func wrapGo(userCode string, spec []models.InputVar, sig models.FuncSignature) string {
	var reads strings.Builder
	needStrconv := false
	for _, v := range spec {
		switch v.Type {
		case models.TypeInt:
			fmt.Fprintf(&reads, "\t%s, _ := strconv.Atoi(_readline())\n", v.Name)
			needStrconv = true
		case models.TypeFloat:
			fmt.Fprintf(&reads, "\t%s, _ := strconv.ParseFloat(_readline(), 64)\n", v.Name)
			needStrconv = true
		case models.TypeBool:
			fmt.Fprintf(&reads, "\t%s := _readline() == \"true\"\n", v.Name)
		case models.TypeString:
			fmt.Fprintf(&reads, "\t%s := _readline()\n", v.Name)
		case models.TypeIntArr:
			fmt.Fprintf(&reads, "\t%s := _readInts(_readline())\n", v.Name)
			needStrconv = true
		case models.TypeFloatArr:
			fmt.Fprintf(&reads, "\t%s := _readFloats(_readline())\n", v.Name)
			needStrconv = true
		case models.TypeStringArr:
			fmt.Fprintf(&reads, "\t%s := strings.Fields(_readline())\n", v.Name)
		}
	}

	strconvImport := ""
	if needStrconv {
		strconvImport = "\n\t\"strconv\""
	}

	callArgs := strings.Join(sig.Params, ", ")

	printResult := "\tfmt.Println(result)"
	switch sig.ReturnType {
	case models.TypeIntArr, models.TypeFloatArr, models.TypeStringArr:
		printResult = `	strs := make([]string, len(result))
	for i, v := range result {
		strs[i] = fmt.Sprint(v)
	}
	fmt.Println(strings.Join(strs, " "))`
	}

	return fmt.Sprintf(`package main

import (
	"bufio"
	"fmt"
	"os"%s
	"strings"
)

var _reader = bufio.NewReader(os.Stdin)

func _readline() string {
	line, _ := _reader.ReadString('\n')
	return strings.TrimSpace(line)
}

func _readInts(line string) []int {
	fields := strings.Fields(line)
	out := make([]int, len(fields))
	for i, f := range fields {
		out[i], _ = strconv.Atoi(f)
	}
	return out
}

func _readFloats(line string) []float64 {
	fields := strings.Fields(line)
	out := make([]float64, len(fields))
	for i, f := range fields {
		out[i], _ = strconv.ParseFloat(f, 64)
	}
	return out
}

// ---- user code ----
%s
// ---- end user code ----

func main() {
%s
	result := %s(%s)
%s
}
`, strconvImport, userCode, reads.String(), sig.FuncName, callArgs, printResult)
}

func wrapJava(userCode string, spec []models.InputVar, sig models.FuncSignature) string {
	var reads strings.Builder
	for _, v := range spec {
		switch v.Type {
		case models.TypeInt:
			fmt.Fprintf(&reads, "\t\tint %s = sc.nextInt();\n", v.Name)
		case models.TypeFloat:
			fmt.Fprintf(&reads, "\t\tdouble %s = sc.nextDouble();\n", v.Name)
		case models.TypeBool:
			fmt.Fprintf(&reads, "\t\tboolean %s = sc.nextBoolean();\n", v.Name)
		case models.TypeString:
			fmt.Fprintf(&reads, "\t\tString %s = sc.next();\n", v.Name)
		case models.TypeIntArr:
			length := lengthExpr(v)
			fmt.Fprintf(&reads, "\t\tint[] %s = new int[%s];\n", v.Name, length)
			fmt.Fprintf(&reads, "\t\tfor (int i = 0; i < %s; i++) %s[i] = sc.nextInt();\n", length, v.Name)
		case models.TypeFloatArr:
			length := lengthExpr(v)
			fmt.Fprintf(&reads, "\t\tdouble[] %s = new double[%s];\n", v.Name, length)
			fmt.Fprintf(&reads, "\t\tfor (int i = 0; i < %s; i++) %s[i] = sc.nextDouble();\n", length, v.Name)
		case models.TypeStringArr:
			length := lengthExpr(v)
			fmt.Fprintf(&reads, "\t\tString[] %s = new String[%s];\n", v.Name, length)
			fmt.Fprintf(&reads, "\t\tfor (int i = 0; i < %s; i++) %s[i] = sc.next();\n", length, v.Name)
		}
	}

	printResult := "\t\tSystem.out.println(result);\n"
	switch sig.ReturnType {
	case models.TypeIntArr, models.TypeFloatArr, models.TypeStringArr:
		printResult = "\t\tfor (int i = 0; i < result.length; i++) {\n\t\t\tif (i > 0) System.out.print(\" \");\n\t\t\tSystem.out.print(result[i]);\n\t\t}\n\t\tSystem.out.println();\n"
	}

	return fmt.Sprintf(`import java.util.*;

public class Main {
%s

	public static void main(String[] args) {
		Scanner sc = new Scanner(System.in);
%s
		%s result = %s(%s);
%s	}
}
`, indent(userCode, "\t"), reads.String(), javaType(sig.ReturnType), sig.FuncName, strings.Join(sig.Params, ", "), printResult)
}

func wrapCPP(userCode string, spec []models.InputVar, sig models.FuncSignature) string {
	var reads strings.Builder
	for _, v := range spec {
		switch v.Type {
		case models.TypeInt:
			fmt.Fprintf(&reads, "\tint %s; cin >> %s;\n", v.Name, v.Name)
		case models.TypeFloat:
			fmt.Fprintf(&reads, "\tdouble %s; cin >> %s;\n", v.Name, v.Name)
		case models.TypeBool:
			fmt.Fprintf(&reads, "\tbool %s; cin >> %s;\n", v.Name, v.Name)
		case models.TypeString:
			fmt.Fprintf(&reads, "\tstring %s; cin >> %s;\n", v.Name, v.Name)
		case models.TypeIntArr:
			length := lengthExpr(v)
			fmt.Fprintf(&reads, "\tvector<int> %s(%s); for (int i = 0; i < %s; i++) cin >> %s[i];\n", v.Name, length, length, v.Name)
		case models.TypeFloatArr:
			length := lengthExpr(v)
			fmt.Fprintf(&reads, "\tvector<double> %s(%s); for (int i = 0; i < %s; i++) cin >> %s[i];\n", v.Name, length, length, v.Name)
		case models.TypeStringArr:
			length := lengthExpr(v)
			fmt.Fprintf(&reads, "\tvector<string> %s(%s); for (int i = 0; i < %s; i++) cin >> %s[i];\n", v.Name, length, length, v.Name)
		}
	}

	printResult := "\tcout << result << '\\n';\n"
	switch sig.ReturnType {
	case models.TypeIntArr, models.TypeFloatArr, models.TypeStringArr:
		printResult = "\tfor (size_t i = 0; i < result.size(); i++) {\n\t\tif (i) cout << ' ';\n\t\tcout << result[i];\n\t}\n\tcout << '\\n';\n"
	}

	return fmt.Sprintf(`#include <bits/stdc++.h>
using namespace std;

%s

int main() {
%s
	auto result = %s(%s);
%s	return 0;
}
`, userCode, reads.String(), sig.FuncName, strings.Join(sig.Params, ", "), printResult)
}

func wrapC(userCode string, spec []models.InputVar, sig models.FuncSignature) string {
	var reads strings.Builder
	for _, v := range spec {
		switch v.Type {
		case models.TypeInt:
			fmt.Fprintf(&reads, "\tint %s; scanf(\"%%d\", &%s);\n", v.Name, v.Name)
		case models.TypeFloat:
			fmt.Fprintf(&reads, "\tdouble %s; scanf(\"%%lf\", &%s);\n", v.Name, v.Name)
		case models.TypeBool:
			fmt.Fprintf(&reads, "\tint %s; scanf(\"%%d\", &%s);\n", v.Name, v.Name)
		case models.TypeString:
			fmt.Fprintf(&reads, "\tchar %s[10005]; scanf(\"%%10004s\", %s);\n", v.Name, v.Name)
		case models.TypeIntArr:
			length := lengthExpr(v)
			fmt.Fprintf(&reads, "\tint %s[%s]; for (int i = 0; i < %s; i++) scanf(\"%%d\", &%s[i]);\n", v.Name, length, length, v.Name)
		case models.TypeFloatArr:
			length := lengthExpr(v)
			fmt.Fprintf(&reads, "\tdouble %s[%s]; for (int i = 0; i < %s; i++) scanf(\"%%lf\", &%s[i]);\n", v.Name, length, length, v.Name)
		case models.TypeStringArr:
			length := lengthExpr(v)
			fmt.Fprintf(&reads, "\tchar %s[%s][10005]; for (int i = 0; i < %s; i++) scanf(\"%%10004s\", %s[i]);\n", v.Name, length, length, v.Name)
		}
	}

	printResult := "\tprintf(\"%d\\n\", result);\n"
	switch sig.ReturnType {
	case models.TypeFloat:
		printResult = "\tprintf(\"%g\\n\", result);\n"
	case models.TypeBool:
		printResult = "\tprintf(\"%d\\n\", result);\n"
	case models.TypeString:
		printResult = "\tprintf(\"%s\\n\", result);\n"
	case models.TypeIntArr, models.TypeFloatArr, models.TypeStringArr:
		printResult = "\t/* Array returns in C require a hand-written driverCode template. */\n"
	}

	return fmt.Sprintf(`#include <stdio.h>
#include <stdlib.h>
#include <string.h>

%s

int main() {
%s
	%s result = %s(%s);
%s	return 0;
}
`, userCode, reads.String(), cType(sig.ReturnType), sig.FuncName, cCallArgs(spec, sig), printResult)
}

func lengthExpr(v models.InputVar) string {
	if v.LengthVar != "" {
		return v.LengthVar
	}
	return "0"
}

func javaType(t models.ParamType) string {
	switch t {
	case models.TypeInt:
		return "int"
	case models.TypeFloat:
		return "double"
	case models.TypeBool:
		return "boolean"
	case models.TypeString:
		return "String"
	case models.TypeIntArr:
		return "int[]"
	case models.TypeFloatArr:
		return "double[]"
	case models.TypeStringArr:
		return "String[]"
	default:
		return "Object"
	}
}

func cppType(t models.ParamType) string {
	switch t {
	case models.TypeInt:
		return "int"
	case models.TypeFloat:
		return "double"
	case models.TypeBool:
		return "bool"
	case models.TypeString:
		return "string"
	case models.TypeIntArr:
		return "vector<int>"
	case models.TypeFloatArr:
		return "vector<double>"
	case models.TypeStringArr:
		return "vector<string>"
	default:
		return "auto"
	}
}

func cType(t models.ParamType) string {
	switch t {
	case models.TypeFloat:
		return "double"
	case models.TypeBool:
		return "int"
	case models.TypeString:
		return "char*"
	default:
		return "int"
	}
}

func cCallArgs(spec []models.InputVar, sig models.FuncSignature) string {
	byName := map[string]models.InputVar{}
	for _, v := range spec {
		byName[v.Name] = v
	}

	args := make([]string, 0, len(sig.Params))
	for _, p := range sig.Params {
		args = append(args, p)
		v, ok := byName[p]
		if !ok || v.LengthVar == "" || !isArrayType(v.Type) || contains(sig.Params, v.LengthVar) {
			continue
		}
		args = append(args, v.LengthVar)
	}
	return strings.Join(args, ", ")
}

func isArrayType(t models.ParamType) bool {
	return t == models.TypeIntArr || t == models.TypeFloatArr || t == models.TypeStringArr
}

func contains(values []string, target string) bool {
	for _, v := range values {
		if v == target {
			return true
		}
	}
	return false
}

func indent(s, prefix string) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	for i, line := range lines {
		if strings.TrimSpace(line) != "" {
			lines[i] = prefix + line
		}
	}
	return strings.Join(lines, "\n")
}
