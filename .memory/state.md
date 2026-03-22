# Working State

## Verified

- `npm.cmd install`
- `npm.cmd run build`
- `npx.cmd tsc -p tsconfig.json --noEmit`
- `npm.cmd run test`
- `python -X utf8 scripts/generate_prd_docs.py Kodo_PRD.docx .`

## Generated Outputs

- `dist/extension.js`
- `webview/dist/app.js`
- `webview/dist/styles.css`
- `docs/**/*.md`

## Notes

- The generated docs can be refreshed from the original DOCX at any time with `npm.cmd run docs:generate`.
- The repo is ready for `git remote add origin ...` and push after review.
