import { defineConfig } from "motiva-compose";

export default defineConfig({
  "models": {
    "conceptPlanner": {
      "provider": "gpt-4o-mini",
      "maxTokens": 4096,
      "temperature": 0.7,
      "timeout": 30000
    },
    "assetSynthesizer": {
      "provider": "gpt-4o-mini",
      "maxTokens": 6144,
      "temperature": 0.7,
      "timeout": 30000
    },
    "director": {
      "provider": "gpt-4o-mini",
      "maxTokens": 4096,
      "temperature": 0.7,
      "timeout": 30000
    },
    "editor": {
      "provider": "gpt-4o-mini",
      "maxTokens": 2048,
      "temperature": 0.7,
      "timeout": 30000
    },
    "critic": {
      "provider": "gpt-4o-mini",
      "maxTokens": 1024,
      "temperature": 0.7,
      "timeout": 30000
    }
  },
  "paths": {
    "assets": "./assets",
    "sceneGraph": "./scene-graph.json",
    "prompts": "./prompts",
    "logs": "./logs"
  },
  "remotion": {
    "fps": 30,
    "size": {
      "w": 1920,
      "h": 1080
    }
  },
  "telemetry": {
    "enabled": false
  },
  "retry": {
    "maxAttempts": 3,
    "backoffMs": 1000
  }
});
