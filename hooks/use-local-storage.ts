import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(
	key: string,
	initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
	// State to store our value
	// Pass initial state function to useState so logic is only executed once
	const [storedValue, setStoredValue] = useState<T>(initialValue);

	// To prevent hydration mismatch, we start with initialValue
	// and update state with localStorage in useEffect
	useEffect(() => {
		try {
			const item = window.localStorage.getItem(key);
			if (item) {
				// We need this to initialize state from localStorage on the client side without hydration mismatch
				// eslint-disable-next-line react-hooks/set-state-in-effect
				setStoredValue(JSON.parse(item));
			}
		} catch (error) {
			console.warn(`Error reading localStorage key "${key}":`, error);
		}
	}, [key]);

	// Return a wrapped version of useState's setter function that ...
	// ... persists the new value to localStorage.
	const setValue = useCallback(
		(value: T | ((val: T) => T)) => {
			try {
				// Allow value to be a function so we have same API as useState
				setStoredValue((oldValue) => {
					const valueToStore =
						value instanceof Function ? value(oldValue) : value;
					if (typeof window !== "undefined") {
						window.localStorage.setItem(key, JSON.stringify(valueToStore));
					}
					return valueToStore;
				});
			} catch (error) {
				console.warn(`Error setting localStorage key "${key}":`, error);
			}
		},
		[key],
	);

	return [storedValue, setValue];
}
