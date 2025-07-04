# plugins (reference)

このフォルダは Motiva Compose に同梱する **サンプル／リファレンス用プラグイン** を配置する場所です。

- `agents/`    エージェントプラグイン (`agent.json` + optional code)
- `providers/` LLM / API Provider プラグイン
- `buses/`     EventBus Driver プラグイン

本体コアとは独立しており、ここに置かれたプラグインは CLI の `--plugins` オプションでロードできます。 