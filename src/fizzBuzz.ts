/**
 * FizzBuzzの判定関数
 */
type Checker = (value: number) => boolean;

/**
 * FizzBuzzのルール定義
 */
type FizzBuzzRule = {
	checker: Checker;
	label: string;
};

const rules = [
	{
		checker: (n) => {
			return n % 3 === 0;
		},
		label: "Fizz",
	},

	{
		checker: (n) => {
			return n % 5 === 0;
		},
		label: "Buzz",
	},
] as const satisfies readonly FizzBuzzRule[];

/**
 * 数値を1つFizzBuzz変換する
 */
const convert = (n: number): string => {
	const result = rules
		.filter((rule) => {
			return rule.checker(n);
		})
		.map((rule) => {
			return rule.label;
		})
		.join("");

	if (result === "") {
		return String(n);
	}

	return result;
};

/**
 * 1からcountまでのFizzBuzz結果を配列で返す
 */
export const fizzBuzz = (count: number): string[] => {
	return Array.from({ length: count }, (_, i) => {
		return convert(i + 1);
	});
};
