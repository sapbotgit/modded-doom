// An implementation of svelte writable but with the ability to fetch current value
// I'd actually prefer not to depend on svelte/store (to make it more portable) the dependency makes it simpler
import { writable, type Writable } from "svelte/store";

export interface Store<T> extends Writable<T> {
    initial: T; // useful for map object so we know the original value of something (like zCeil or zFloor)
    val: T;
}

// see https://github.com/sveltejs/svelte/issues/2060#issuecomment-741776507
export function store<T>(value: T): Store<T> {
    const store = writable(value);
    const obj = {
        set: (val: T) => store.set(obj.val = val),
        update: (fn: (v: T) => T) => store.update(val => obj.val = fn(val)),
        subscribe: store.subscribe,
        initial: value,
        val: value,
    }
    return obj;
}