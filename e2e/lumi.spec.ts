import { expect, test } from "@playwright/test";

test("home, chat, and looks paths render in mobile shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Lumi home" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Meet Mochi", level: 1 }),
  ).toBeVisible();

  await page.getByRole("link", { name: /Chat/i }).first().click();
  await expect(page.getByPlaceholder("Ask Mochi about the look...")).toBeVisible();
  await page.getByPlaceholder("Ask Mochi about the look...").click();
  await page.keyboard.type("Color help?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/Lilac with emerald/i)).toBeVisible();

  await page.goto("/looks");
  await expect(page.getByRole("heading", { name: "Saved looks" })).toBeVisible();
  await expect(page.getByText(/Soft Icon/i)).toBeVisible();
});

test("core mobile routes render", async ({ page }) => {
  for (const path of ["/", "/chat", "/camera", "/memory", "/looks", "/profile"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: "Lumi home" })).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
  }
});

test("chat image attachments can be removed and sent", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByPlaceholder("Ask Mochi about the look...")).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "look.png",
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  });
  await expect(page.getByText("Ready for Mochi")).toBeVisible();
  await page.getByText("remove").click();
  await expect(page.getByText("Ready for Mochi")).toBeHidden();

  await page.locator('input[type="file"]').setInputFiles({
    name: "look.png",
    mimeType: "image/png",
    buffer: Buffer.from("image"),
  });
  await expect(page.getByText("Ready for Mochi")).toBeVisible();
  await page.getByPlaceholder("Ask Mochi about the look...").fill("Review this");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/This has promise|Lilac with emerald/i)).toBeVisible();
});

test("memory page edits style memory", async ({ page }) => {
  await page.goto("/memory");
  await expect(page.getByLabel("Style summary")).toBeVisible();

  await page.getByLabel("Style summary").fill("clean casual");
  await page.getByLabel("Favorite colors").fill("black, white");
  await page.getByLabel("Avoid").fill("neon, logos");
  await page.getByRole("button", { name: "Save Mochi memory" }).click();

  await expect(page.getByLabel("Style summary")).toHaveValue("clean casual");
});

test("live voice uses mocked websocket and releases microphone on hangup", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/chat");
  await expect(page.getByRole("button", { name: "Start live voice chat" })).toBeVisible();
  await page.getByPlaceholder("Ask Mochi about the look...").fill("ready");
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  await page.getByPlaceholder("Ask Mochi about the look...").fill("");

  await page.evaluate(() => {
    class MockMediaRecorder extends EventTarget {
      static isTypeSupported() {
        return true;
      }

      state = "inactive";

      stream: MediaStream;
      options?: MediaRecorderOptions;

      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        super();
        this.stream = stream;
        this.options = options;
      }

      start() {
        this.state = "recording";
        setTimeout(() => {
          this.dispatchEvent(
            new BlobEvent("dataavailable", {
              data: new Blob(["audio"], { type: "audio/webm;codecs=opus" }),
            }),
          );
        }, 25);
      }

      stop() {
        this.state = "inactive";
      }
    }

    class MockWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 3;
      readyState = MockWebSocket.CONNECTING;
      sent: unknown[] = [];

      url: string;

      constructor(url: string) {
        super();
        this.url = url;
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.dispatchEvent(new Event("open"));
          this.dispatchEvent(
            new MessageEvent("message", {
              data: JSON.stringify({ type: "ready" }),
            }),
          );
        }, 25);
      }

      send(payload: unknown) {
        this.sent.push(payload);
        if (typeof payload === "string" && payload.includes('"type":"start"')) {
          setTimeout(() => {
            this.dispatchEvent(
              new MessageEvent("message", {
                data: JSON.stringify({ type: "message", text: "Mock live hello" }),
              }),
            );
            this.dispatchEvent(
              new MessageEvent("message", {
                data: JSON.stringify({ type: "done" }),
              }),
            );
          }, 25);
        }
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
        this.dispatchEvent(new CloseEvent("close"));
      }
    }

    class MockAudioContext {
      destination = {};

      createMediaStreamSource() {
        return { connect: () => undefined };
      }

      createAnalyser() {
        return {
          fftSize: 256,
          smoothingTimeConstant: 0.72,
          frequencyBinCount: 8,
          getByteFrequencyData: (data: Uint8Array) => data.fill(36),
        };
      }

      decodeAudioData() {
        return Promise.resolve({});
      }

      createBufferSource() {
        return {
          buffer: null,
          connect: () => undefined,
          start() {
            setTimeout(() => this.onended?.(), 1);
          },
          onended: undefined as undefined | (() => void),
        };
      }

      close() {
        (window as unknown as { __audioClosed: boolean }).__audioClosed = true;
        return Promise.resolve();
      }
    }

    (window as unknown as { __trackStopped: boolean }).__trackStopped = false;
    (window as unknown as { __audioClosed: boolean }).__audioClosed = false;
    (window as unknown as { __getUserMediaCalled: boolean }).__getUserMediaCalled = false;
    const mediaDevices = {
        getUserMedia: () => {
          (window as unknown as { __getUserMediaCalled: boolean }).__getUserMediaCalled = true;
          return Promise.resolve({
            active: true,
            getTracks: () => [
              {
                stop: () => {
                  (window as unknown as { __trackStopped: boolean }).__trackStopped = true;
                },
              },
            ],
          });
        },
      };

    Object.defineProperty(navigator, "mediaDevices", {
      value: mediaDevices,
      configurable: true,
    });
    Object.defineProperty(Object.getPrototypeOf(navigator), "mediaDevices", {
      get: () => mediaDevices,
      configurable: true,
    });
    Object.defineProperty(window, "MediaRecorder", {
      value: MockMediaRecorder,
      configurable: true,
    });
    Object.defineProperty(window, "WebSocket", {
      value: MockWebSocket,
      configurable: true,
    });
    Object.defineProperty(window, "AudioContext", {
      value: MockAudioContext,
      configurable: true,
    });
    Object.defineProperty(window, "webkitAudioContext", {
      value: MockAudioContext,
      configurable: true,
    });
  });

  expect(
    await page.evaluate(() => ({
      hasMedia:
        typeof navigator.mediaDevices?.getUserMedia === "function",
      mediaRecorder: window.MediaRecorder?.name,
      socket: window.WebSocket?.name,
      audio: window.AudioContext?.name,
    })),
  ).toEqual({
    hasMedia: true,
    mediaRecorder: "MockMediaRecorder",
    socket: "MockWebSocket",
    audio: "MockAudioContext",
  });
  await page.getByRole("button", { name: "Start live voice chat" }).click();
  expect(pageErrors).toEqual([]);
  expect(
    await page.evaluate(
      () => (window as unknown as { __getUserMediaCalled: boolean }).__getUserMediaCalled,
    ),
  ).toBe(true);
  await expect(page.getByText("Live listening")).toBeVisible();
  await expect(page.getByText("Mock live hello")).toBeVisible();

  await page.getByRole("button", { name: "End live voice chat" }).click();
  await expect(page.getByRole("button", { name: "Start live voice chat" })).toBeVisible();
  await expect(
    page.waitForFunction(
      () =>
        (window as unknown as { __trackStopped: boolean }).__trackStopped &&
        (window as unknown as { __audioClosed: boolean }).__audioClosed,
    ),
  ).resolves.toBeTruthy();
});
