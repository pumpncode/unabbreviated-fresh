---
description: Plugins can add new functionality to Fresh without requiring significant complexity.
---

The `Context` instance is shared across all middlewares in Fresh. Use it to
respond with HTML, trigger redirects, access the incoming
[`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) or read
other metadata.

## `.config`

Contains the resolved Fresh configuration.

```ts
app.get("/", (context) => {
  console.log("Config: ", context.config);
  return new Response("hey");
});
```

## `.url`

Contains a [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL)
instance of the requested url.

```ts
app.get("/", (context) => {
  console.log("path: ", context.url.pathname);

  const hasParam = context.url.searchParams.has("q");
  return new Response(`Has q param: ${String(hasParam)});
});
```

## `.request`

Contains the incoming
[`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) instance.

```ts
app.get("/", (context) => {
  console.log("Request: ", context.request);

  if (context.request.headers.has("X-Foo")) {
    // do something
  }

  return new Response("hello");
});
```

## `.route`

Contains the matched route pattern as a `string`. Will be `null` if no pattern
matched.

```ts
app.get("/foo/:id", (context) => {
  console.log(context.route); // Logs: "/foo/:id
  // ...
});
```

## `.params`

Contains the params of the matched route pattern.

```ts
app.get("/foo/:id", (context) => {
  console.log("id: ", context.params.id);

  return new Response(`Accessed: /foo/${context.params.id}`);
});
```

## `.state`

Pass data to the next middlewares with state. Every request has its own state
object.

```ts
interface State {
  text?: string;
}

const app = new App<State>();

app.use((ctx) => {
  ctx.state.text = "foo";
  return ctx.next();
});
app.use((context) => {
  console.log(context.state.text); // Logs: "foo"
  return context.next();
});
```

## `.error`

If an error was thrown, this property will hold the caught value (default:
`null`). This is typically used mainly on an error page.

```ts
app.onError((context) => {
  const message = context.error instanceof Error
    ? context.error.message
    : String(context.error);

  return new Response(message, { status: 500 });
});
```

## `.redirect()`

Trigger a redirect from a middleware:

```ts
app.get("/old-url", (context) => {
  return context.redirect("/new-url");
});
```

Set a custom status code (default is `302`):

```ts
app.get("/old-url", (context) => {
  return context.redirect("/new-url", 307);
});
```

## `.render()`

Render JSX and create a HTML `Response`.

```tsx
app.get("/", (context) => {
  return context.render(<h1>hello world</h1>);
});
```

Set custom response headers or other metadata:

```tsx
app.get("/teapot", (context) => {
  return context.render(
    <h1>I'm a teapot</h1>,
    {
      status: 418,
      headers: {
        "X-Foo": "abc",
      },
    },
  );
});
```
