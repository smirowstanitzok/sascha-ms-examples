type Path<Whole extends string, Part extends Whole> = `${Whole}/${Part}`;

// Fix: check again in the branch whether Part fits the distributed Whole
type Route<Whole extends string, Part extends Whole> =
  Whole extends Part
    ? Whole
    : Part extends Whole
      ? Path<Whole, Part>
      : never;

export type Example = Route<"api" | "web", "api">;
// resolves to "api"
const test: Example = "api";
export { test };
