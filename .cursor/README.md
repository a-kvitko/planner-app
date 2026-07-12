# MCP (Model Context Protocol)

## Figma MCP

В `.cursor/mcp.json` подключён **Framelink MCP for Figma** — он даёт агенту доступ к данным из ваших Figma-файлов.

### Что сделать перед использованием

1. **Создайте Personal Access Token в Figma**
   - [Инструкция Figma](https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens)

2. **Подставьте токен в конфиг**
   - Откройте `.cursor/mcp.json`
   - Замените `YOUR_FIGMA_ACCESS_TOKEN` на ваш токен (в поле `env.FIGMA_API_KEY`)

   Либо задайте переменную окружения `FIGMA_API_KEY` в системе и уберите блок `env` из конфига, чтобы не хранить токен в файле.

3. **Перезапустите Cursor** полностью (Quit и снова откройте), чтобы подхватился MCP.

После этого в Composer (Agent) можно вставлять ссылку на Figma и просить реализовать дизайн — агент сможет запрашивать данные через MCP.
