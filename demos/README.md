# Three live demos

These recordings show real on-device inference. Model initialization happens before recording; WebM videos retain classification latency. GIF previews play at 2× speed. Samples are ordinary input text, not fixture responses or examples supplied to the model.

## Plain text → formatted document

Titles, section headings, lists, and syntax-highlighted source code, inferred without Markdown markers. Qwen3 4B through WebLLM chooses constrained document roles and code languages; the renderer preserves the supplied text.

![Zero-shot autoformat](featured/autoformat.gif)

[Watch the video](featured/autoformat.webm)

## A reaction that follows what you type

The message changes from celebration to anger to laughter, and Liquid d1-omni-600M chooses the corresponding emoji.

![Live emoji](featured/live-emoji.gif)

[Watch the video](featured/live-emoji.webm)

## Customer messages → the right team

Three different messages are classified by Liquid d1-omni-600M and placed in Billing, Engineering, and Support.

![Inbox routing](featured/inbox-routing.gif)

[Watch the video](featured/inbox-routing.webm)

Run the app with `npm run dev`. Regenerate with `npm run record:featured`; run acceptance checks with `npm run verify:demos`. Chrome and FFmpeg are required. The earlier fixture previews remain in [the archive](legacy.md).
