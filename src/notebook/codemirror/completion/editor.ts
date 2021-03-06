// Copyright (c) Jupyter Development Team.

// Distributed under the terms of the Modified BSD License.

import {
  defineSignal, ISignal
} from 'phosphor/lib/core/signaling';

import {
  CodeMirrorCellEditorWidget
} from '../cells/editor';

import {
  CompletableEditorWidget, ITextChange, ICompletionRequest, ICoords
} from '../../completion/editor';

export * from '../cells/editor';
export * from '../../completion/view';

/**
 * The key code for the tab key.
 */
export
const TAB = 9;

/**
 * A completable code mirror widget for a cell editor.
 */
export
class CompletableCodeMirrorCellEditorWidget extends CodeMirrorCellEditorWidget implements CompletableEditorWidget {

  /**
   * A signal emitted when a tab (text) completion is requested.
   */
  completionRequested: ISignal<CompletableEditorWidget, ICompletionRequest>;

  /**
   * A signal emitted when a text change is completed.
   */
  textChanged: ISignal<CompletableEditorWidget, ITextChange>;

  /**
   * Handle change events from the document.
   */
  protected onDocChange(doc: CodeMirror.Doc, change: CodeMirror.EditorChange): void {
    super.onDocChange(doc, change);

    let model = this.presenter.model;
    let editor = this.editor;
    let oldValue = model ? model.source : null;
    let newValue = doc.getValue();
    let cursor = doc.getCursor();
    let line = cursor.line;
    let ch = cursor.ch;
    let chHeight = editor.defaultTextHeight();
    let chWidth = editor.defaultCharWidth();
    let coords = editor.charCoords({ line, ch }, 'page') as ICoords;
    let position = editor.getDoc().indexFromPos({ line, ch });

    this.textChanged.emit({
      line, ch, chHeight, chWidth, coords, position, oldValue, newValue
    });
  }

  /**
   * Handle keydown events from the editor.
   */
  protected onEditorKeydown(editor: CodeMirror.Editor, event: KeyboardEvent): void {
    if (event.keyCode === TAB) {
      // If the tab is modified, ignore it.
      if (event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) {
        return;
      }
      const doc = editor.getDoc();
      const cursor = doc.getCursor();
      const line = cursor.line;
      const ch = cursor.ch;
      return this.onTabEvent(event, ch, line);
    }
    super.onEditorKeydown(editor, event);
  }

  /**
   * Handle a tab key press.
   */
  protected onTabEvent(event: KeyboardEvent, ch: number, line: number): void {
    const editor = this.editor;
    const doc = editor.getDoc();

    // If there is a text selection, no completion requests should be emitted.
    if (doc.getSelection()) {
      return;
    }

    const currentValue = doc.getValue();
    const currentLine = currentValue.split('\n')[line];

    // A completion request signal should only be emitted if the current
    // character or a preceding character is not whitespace.
    //
    // Otherwise, the default tab action of creating a tab character should be
    // allowed to propagate.
    if (!currentLine.substring(0, ch).match(/\S/)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const chHeight = editor.defaultTextHeight();
    const chWidth = editor.defaultCharWidth();
    const coords = editor.charCoords({ line, ch }, 'page') as ICoords;
    const position = editor.getDoc().indexFromPos({ line, ch });
    let data = {
      line, ch, chHeight, chWidth, coords, position, currentValue
    };
    this.completionRequested.emit(data as ICompletionRequest);
  }

}

// Define the signals for the `CompletableCodeMirrorCellEditorWidget` class.
defineSignal(CodeMirrorCellEditorWidget.prototype, 'textChanged');
defineSignal(CodeMirrorCellEditorWidget.prototype, 'completionRequested');

