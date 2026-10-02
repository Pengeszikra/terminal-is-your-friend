// Coded by OpenAI Codex. Background type-checking uses the same native pipeline fork.
import { createVercelHandler } from "../server/vercel-handler.mjs";

export default createVercelHandler({ checkOnly: true });
