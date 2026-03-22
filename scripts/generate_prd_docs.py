from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET
from zipfile import ZipFile

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


@dataclass
class Block:
    kind: str
    text: str = ""
    rows: list[list[str]] | None = None
    level: int = 0


SECTION_TARGETS = {
    "1. EXECUTIVE SUMMARY": Path("docs/prd/executive-summary.md"),
    "2. PRODUCT OVERVIEW": Path("docs/prd/product-overview.md"),
    "4. TECHNICAL ARCHITECTURE": Path("docs/architecture/technical-architecture.md"),
    "5. AI INTEGRATION LAYER": Path("docs/architecture/ai-integration.md"),
    "6. PRODUCTION FOLDER STRUCTURE": Path("docs/reference/folder-structure.md"),
    "7. DEVELOPMENT ROADMAP": Path("docs/implementation/roadmap.md"),
    "8. ENGINEERING CHALLENGES — BRUTALLY REALISTIC": Path("docs/reference/engineering-challenges.md"),
    "9. TECHNOLOGY STACK — JUSTIFIED CHOICES": Path("docs/reference/technology-stack.md"),
    "10. PERFORMANCE TARGETS & SLAs": Path("docs/reference/performance-targets.md"),
    "11. SECURITY & PRIVACY": Path("docs/reference/security-privacy.md"),
    "12. EXTENSION MANIFEST (package.json) — KEY SECTIONS": Path("docs/reference/extension-manifest.md"),
    "13. CRITICAL CODE SNIPPETS": Path("docs/reference/critical-code-snippets.md"),
    "14. SUCCESS METRICS & KPIs": Path("docs/implementation/success-metrics.md"),
    "APPENDIX A: DECISION LOG": Path("docs/reference/decision-log.md"),
    "APPENDIX B: GLOSSARY": Path("docs/reference/glossary.md"),
}

FEATURE_TARGETS = {
    "3.1 Inline AI Editing (Ghost Text Engine)": Path("docs/features/inline-ai-editing.md"),
    "3.2 AI Chat Panel": Path("docs/features/ai-chat-panel.md"),
    "3.3 Codebase Awareness & Context Engine": Path("docs/features/codebase-awareness-context-engine.md"),
    "3.4 Multi-File Editing Agent": Path("docs/features/multi-file-editing-agent.md"),
    "3.5 Streaming System": Path("docs/features/streaming-system.md"),
}


def get_text(node: ET.Element) -> str:
    return "".join(t.text or "" for t in node.findall(".//w:t", NS)).strip()


def get_style(node: ET.Element) -> str:
    ppr = node.find("w:pPr", NS)
    if ppr is None:
        return ""
    style = ppr.find("w:pStyle", NS)
    if style is None:
        return ""
    return style.attrib.get(f"{{{NS['w']}}}val", "")


def iter_blocks(docx: Path) -> Iterable[Block]:
    with ZipFile(docx) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))

    body = root.find("w:body", NS)
    if body is None:
        return

    for child in body:
        tag = child.tag.split("}")[-1]
        if tag == "p":
            text = get_text(child)
            if not text:
                continue
            style = get_style(child)
            if style.startswith("Heading"):
                yield Block(kind="heading", text=text, level=int(style.replace("Heading", "")))
            elif style == "ListParagraph":
                yield Block(kind="list", text=text)
            else:
                yield Block(kind="paragraph", text=text)
        elif tag == "tbl":
            rows: list[list[str]] = []
            for tr in child.findall("w:tr", NS):
                row: list[str] = []
                for tc in tr.findall("w:tc", NS):
                    row.append(" ".join(get_text(tc).split()))
                if any(row):
                    rows.append(row)
            if rows:
                yield Block(kind="table", rows=rows)


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def is_codeish(text: str) -> bool:
    prefixes = (
        "//",
        "export ",
        "async ",
        "type ",
        "interface ",
        "class ",
        "const ",
        "let ",
        "if ",
        "for ",
        "while ",
        "{",
        "}",
        "| {",
        "┌",
        "│",
        "└",
        "├",
        "↓",
        '"',
    )
    return (
        text.startswith(prefixes)
        or "=>" in text
        or text.endswith("{")
        or text.endswith("}")
        or text == "[DONE]"
    )


def table_to_markdown(rows: list[list[str]]) -> str:
    width = max(len(row) for row in rows)
    normalized = [row + [""] * (width - len(row)) for row in rows]
    header = "| " + " | ".join(normalized[0]) + " |"
    divider = "| " + " | ".join("---" for _ in range(width)) + " |"
    body = ["| " + " | ".join(row) + " |" for row in normalized[1:]]
    return "\n".join([header, divider, *body])


def blocks_to_markdown(blocks: list[Block]) -> str:
    lines: list[str] = []
    code_buffer: list[str] = []

    def flush_code() -> None:
        if not code_buffer:
            return
        lines.append("```text")
        lines.extend(code_buffer)
        lines.append("```")
        lines.append("")
        code_buffer.clear()

    for block in blocks:
        if block.kind == "heading":
            flush_code()
            lines.append("#" * block.level + f" {block.text}")
            lines.append("")
        elif block.kind == "list":
            flush_code()
            lines.append(f"- {block.text}")
        elif block.kind == "table":
            flush_code()
            lines.append(table_to_markdown(block.rows or []))
            lines.append("")
        elif block.kind == "paragraph":
            if is_codeish(block.text):
                code_buffer.append(block.text)
            else:
                flush_code()
                lines.append(block.text)
                lines.append("")

    flush_code()
    return "\n".join(lines).strip() + "\n"


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: generate_prd_docs.py <docx> <output-root>")
        return 1

    docx = Path(sys.argv[1]).resolve()
    root = Path(sys.argv[2]).resolve()
    blocks = list(iter_blocks(docx))

    write(root / "docs/prd/full-prd.md", blocks_to_markdown(blocks))

    current_section = ""
    current_feature = ""
    section_buckets: dict[str, list[Block]] = {}
    feature_buckets: dict[str, list[Block]] = {}

    for block in blocks:
        if block.kind == "heading" and block.level == 1:
            current_section = block.text
            current_feature = ""
        if block.kind == "heading" and block.level == 2:
            if current_section == "3. CORE FEATURES — DEEP SPECIFICATION":
                current_feature = block.text
            else:
                current_feature = ""

        if current_section:
            section_buckets.setdefault(current_section, []).append(block)
        if current_feature:
            feature_buckets.setdefault(current_feature, []).append(block)

    for section, target in SECTION_TARGETS.items():
        bucket = section_buckets.get(section)
        if bucket:
            write(root / target, blocks_to_markdown(bucket))

    for feature, target in FEATURE_TARGETS.items():
        bucket = feature_buckets.get(feature)
        if bucket:
            write(root / target, blocks_to_markdown(bucket))

    docs_index = """# Documentation Index

- [Full PRD](./prd/full-prd.md)
- [Executive Summary](./prd/executive-summary.md)
- [Product Overview](./prd/product-overview.md)
- [Inline AI Editing](./features/inline-ai-editing.md)
- [AI Chat Panel](./features/ai-chat-panel.md)
- [Codebase Awareness & Context Engine](./features/codebase-awareness-context-engine.md)
- [Multi-File Editing Agent](./features/multi-file-editing-agent.md)
- [Streaming System](./features/streaming-system.md)
- [Technical Architecture](./architecture/technical-architecture.md)
- [AI Integration](./architecture/ai-integration.md)
- [Production Folder Structure](./reference/folder-structure.md)
- [Development Roadmap](./implementation/roadmap.md)
- [Engineering Challenges](./reference/engineering-challenges.md)
- [Technology Stack](./reference/technology-stack.md)
- [Performance Targets](./reference/performance-targets.md)
- [Security & Privacy](./reference/security-privacy.md)
- [Extension Manifest](./reference/extension-manifest.md)
- [Critical Code Snippets](./reference/critical-code-snippets.md)
- [Success Metrics](./implementation/success-metrics.md)
- [Decision Log](./reference/decision-log.md)
- [Glossary](./reference/glossary.md)
"""
    write(root / "docs/README.md", docs_index)

    manifest = {
        "source": docx.name,
        "generated": True,
        "sections": len(section_buckets),
        "feature_docs": len(feature_buckets),
    }
    manifest_lines = ["# PRD Conversion Manifest", ""]
    for key, value in manifest.items():
        manifest_lines.append(f"- **{key}**: {value}")
    manifest_lines.append("")
    write(root / "docs/prd/conversion-manifest.md", "\n".join(manifest_lines))

    print(f"Generated Markdown docs from {docx.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
