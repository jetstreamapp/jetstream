import type { OnMount } from '@monaco-editor/react';
import type { editor, Range } from 'monaco-editor';
import { useCallback, useEffect, useRef } from 'react';

export const COVERAGE_COVERED_CLASS = 'jetstream-coverage-covered';
export const COVERAGE_UNCOVERED_CLASS = 'jetstream-coverage-uncovered';
export const COVERAGE_COVERED_GUTTER_CLASS = 'jetstream-coverage-covered-gutter';
export const COVERAGE_UNCOVERED_GUTTER_CLASS = 'jetstream-coverage-uncovered-gutter';
/** Glyph-margin marks (✓ / ✗) so covered vs uncovered is not conveyed by colour alone */
export const COVERAGE_COVERED_GLYPH_CLASS = 'jetstream-coverage-covered-glyph';
export const COVERAGE_UNCOVERED_GLYPH_CLASS = 'jetstream-coverage-uncovered-glyph';

interface CoverageLines {
  coveredLines: number[];
  uncoveredLines: number[];
}

type MonacoInstance = Parameters<OnMount>[1];

/**
 * Applies whole-line background + gutter decorations for covered/uncovered lines to a Monaco editor.
 * Wire `onEditorMount` to the editor's `onMount`, then call `setCoverage` whenever line data changes —
 * either order works, decorations are applied once both are available.
 */
export function useCoverageDecorations() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<MonacoInstance | null>(null);
  const collectionRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const coverageRef = useRef<CoverageLines | null>(null);

  const applyDecorations = useCallback(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    const coverage = coverageRef.current;
    if (!editorInstance || !monaco || !coverage) {
      return;
    }
    collectionRef.current?.clear();
    const buildDecoration = (
      line: number,
      className: string,
      gutterClassName: string,
      glyphClassName: string,
    ): editor.IModelDeltaDecoration => ({
      range: new monaco.Range(line, 1, line, 1) as Range,
      options: {
        isWholeLine: true,
        className,
        linesDecorationsClassName: gutterClassName,
        glyphMarginClassName: glyphClassName,
      },
    });
    collectionRef.current = editorInstance.createDecorationsCollection([
      ...coverage.coveredLines.map((line) =>
        buildDecoration(line, COVERAGE_COVERED_CLASS, COVERAGE_COVERED_GUTTER_CLASS, COVERAGE_COVERED_GLYPH_CLASS),
      ),
      ...coverage.uncoveredLines.map((line) =>
        buildDecoration(line, COVERAGE_UNCOVERED_CLASS, COVERAGE_UNCOVERED_GUTTER_CLASS, COVERAGE_UNCOVERED_GLYPH_CLASS),
      ),
    ]);
  }, []);

  const onEditorMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;
      monacoRef.current = monaco;
      applyDecorations();
    },
    [applyDecorations],
  );

  const setCoverage = useCallback(
    (coverage: CoverageLines | null) => {
      coverageRef.current = coverage;
      if (!coverage) {
        collectionRef.current?.clear();
        return;
      }
      applyDecorations();
    },
    [applyDecorations],
  );

  useEffect(() => {
    return () => {
      collectionRef.current?.clear();
    };
  }, []);

  return { onEditorMount, setCoverage };
}
