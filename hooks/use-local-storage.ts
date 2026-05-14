import { useCallback, useSyncExternalStore } from "react";

function subscribeToStorage(key: string, callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) callback();
  };
  const onLocalUpdate = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(`local-storage:${key}`, onLocalUpdate);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(`local-storage:${key}`, onLocalUpdate);
  };
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
  const storedValue = useSyncExternalStore(
    (callback) => subscribeToStorage(key, callback),
    () => {
      try {
        const item = window.localStorage.getItem(key);
        return item ? (JSON.parse(item) as T) : initialValue;
      } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
        return initialValue;
      }
    },
    () => initialValue,
  );

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function so we have same API as useState
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        if (typeof window !== "undefined") {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          window.dispatchEvent(new Event(`local-storage:${key}`));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue],
  );

  return [storedValue, setValue];
}
