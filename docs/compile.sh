#!/bin/bash
# Compile LaTeX paper with citations
cd "$(dirname "$0")"

echo "🔨 Compiling paper with citations..."
pdflatex -interaction=nonstopmode tei-paper.tex > /dev/null
bibtex tei-paper
pdflatex -interaction=nonstopmode tei-paper.tex > /dev/null
pdflatex -interaction=nonstopmode tei-paper.tex > /dev/null

echo "✅ Done! Check tei-paper.pdf"
ls -lh tei-paper.pdf
