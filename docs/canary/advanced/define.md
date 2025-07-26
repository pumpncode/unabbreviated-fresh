---
description: |
  Define helpers are a less TypeScripty way to declare middlewares, routes and layouts
---

Define helpers can be used to shorten the amount of types you have to type
yourself in code. They are entirely optional as some developers prefer the
expliciteness of types, other's like the convenience of `define.*` helpers.

Without define helpers:

```ts
interface State {
  foo: string;
}

async function myMiddleware(context: Context<State>): Promise<Response> {
  return new Response("hello " + context.state.foo);
}

async function otherMiddleware(context: Context<State>): Promise<Response> {
  return new Response("other " + context.state.foo);
}
```

With define helpers:

```ts
// Setup, do this once in a file and import it everywhere else.
const define = createDefine<{ foo: string }>();

// Usage
const myMiddleware = define.middleware((context) => {
  return new Response("hello " + context.state.foo);
});

const otherMiddleware = define.middleware((context) => {
  return new Response("other " + context.state.foo);
});
```

## File routes

The `define.*` helpers include a `define.handler()` and `define.page()` function
to make it easy for TypeScript to establish a relation between the two. That way
when you can pass data from the handler to the component in a type-safe way.

```tsx routes/index.tsx
export const handler = define.handlers({
  GET(context) {
    return { data: { foo: "Deno" } };
  },
});

// When you type `props.data.*` you'll get autocompletion
export default define.page<typeof handler>((props) => {
  return (
    <div>
      <h1>I like {props.data.foo}</h1>
    </div>
  );
});
```
