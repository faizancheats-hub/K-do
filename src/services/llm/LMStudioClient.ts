import { OpenAIClient } from "./OpenAIClient";

export class LMStudioClient extends OpenAIClient {
  override readonly provider = "lmstudio";
}
