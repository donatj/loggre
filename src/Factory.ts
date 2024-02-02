export function factory<T>(
	f: (...args: any[]) => T,
	...args: any[]
): T {
	return f(...args);
}
