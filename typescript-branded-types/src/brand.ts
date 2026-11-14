// src/brand.ts
// A symbol that exists only at compile time. There is no value behind it,
// so nobody can accidentally create the brand at runtime.
declare const brand: unique symbol;

// Brand<string, "BookId"> is a string with an invisible brand.
export type Brand<T, B extends string> = T & { readonly [brand]: B };
