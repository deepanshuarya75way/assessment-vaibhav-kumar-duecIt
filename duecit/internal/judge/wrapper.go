package judge

import "fmt"

// WrapPracticeCode wraps a user's "logic-only" function in the stdin/stdout
// boilerplate needed by Piston, so in practice mode the user only writes
// the algorithm – not the I/O scaffolding.
//
// The convention is:
//   - The user writes a function named `solve` (or equivalent per language).
//   - The wrapper reads all stdin, calls solve(), and prints the result.
//
// This is intentionally simple. For complex input shapes the problem
// should either use competitive mode or ship a custom starterCode that
// already includes the wrapper.
func WrapPracticeCode(userCode, language string) string {
	switch language {
	case "python":
		return fmt.Sprintf(`import sys
_input_lines = sys.stdin.read().strip().split('\n')
_ptr = [0]

def _readline():
    line = _input_lines[_ptr[0]] if _ptr[0] < len(_input_lines) else ''
    _ptr[0] += 1
    return line.strip()

def _read_int():
    return int(_readline())

def _read_ints():
    return list(map(int, _readline().split()))

def _read_str():
    return _readline()

# ---- user code ----
%s
# ---- end user code ----

# Entrypoint: call solve() and print result
_result = solve()
if _result is not None:
    print(_result)
`, userCode)

	case "javascript":
		return fmt.Sprintf(`const _lines = require('fs').readFileSync(0,'utf8').trim().split('\n');
let _ptr = 0;
const readline = () => (_lines[_ptr++] || '').trim();
const readInt = () => parseInt(readline());
const readInts = () => readline().split(/\s+/).map(Number);

// ---- user code ----
%s
// ---- end user code ----

const _result = solve();
if (_result !== undefined && _result !== null) process.stdout.write(String(_result) + '\n');
`, userCode)

	case "cpp":
		return fmt.Sprintf(`#include <bits/stdc++.h>
using namespace std;

// ---- user code ----
%s
// ---- end user code ----

int main() {
    auto result = solve();
    cout << result << endl;
    return 0;
}
`, userCode)

	case "java":
		return fmt.Sprintf(`import java.util.*;

// ---- user code ----
%s
// ---- end user code ----

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        Solution sol = new Solution();
        // For practice mode the user's Solution class should have a solve() method
        // that reads from Scanner sc
    }
}
`, userCode)

	case "go":
		return fmt.Sprintf(`package main

import (
	"bufio"
	"fmt"
	"os"
)

var _reader = bufio.NewReader(os.Stdin)

// ---- user code ----
%s
// ---- end user code ----

func main() {
	result := solve()
	fmt.Println(result)
}
`, userCode)

	default:
		// For unknown languages, return as-is
		return userCode
	}
}
