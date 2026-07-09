package judge

import (
	"strconv"
	"strings"

	"github.com/duecit/duecit/internal/models"
)

func CheckerForProblem(problem *models.Problem) OutputChecker {
	if problem == nil {
		return nil
	}
	titleKey := strings.ToLower(strings.ReplaceAll(problem.Title, " ", ""))
	if titleKey == "twosum" || strings.EqualFold(problem.Signature.FuncName, "twoSum") {
		return checkTwoSumOutput
	}
	return nil
}

func checkTwoSumOutput(tc models.TestCase, actualOutput string) bool {
	nums, target, ok := parseTwoSumInput(tc.Input)
	if !ok {
		return false
	}

	fields := strings.Fields(actualOutput)
	if len(fields) != 2 {
		return false
	}
	i, err := strconv.Atoi(fields[0])
	if err != nil {
		return false
	}
	j, err := strconv.Atoi(fields[1])
	if err != nil {
		return false
	}
	if i < 0 || j < 0 || i >= len(nums) || j >= len(nums) || i == j {
		return false
	}
	return nums[i]+nums[j] == target
}

func parseTwoSumInput(input string) ([]int, int, bool) {
	fields := strings.Fields(input)
	if len(fields) < 3 {
		return nil, 0, false
	}
	n, err := strconv.Atoi(fields[0])
	if err != nil || n < 2 || len(fields) < n+2 {
		return nil, 0, false
	}
	nums := make([]int, n)
	for i := range nums {
		nums[i], err = strconv.Atoi(fields[i+1])
		if err != nil {
			return nil, 0, false
		}
	}
	target, err := strconv.Atoi(fields[n+1])
	if err != nil {
		return nil, 0, false
	}
	return nums, target, true
}
