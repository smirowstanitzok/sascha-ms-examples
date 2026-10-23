// src/types/assets.d.ts
declare module "*" with { type: "text" } {
  const content: string;
  export default content;
}

// somewhere in your code
import template from "./mail-template.html" with { type: "text" };
// template is now a string
