export function factory<T, Args extends unknown[]>(
	f: (...args: Args) => T,
	...args: Args
): T {
	return f(...args);
}
