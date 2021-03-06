// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  IKernel, KernelMessage
} from 'jupyter-js-services';

import {
  IDisposable
} from 'phosphor/lib/core/disposable';

import {
  clearSignalData, defineSignal, ISignal
} from 'phosphor/lib/core/signaling';

import {
  IEditorView, IEditorModel
} from '../editorwidget/view';

import {
  RenderMime
} from '../rendermime';

import {
  Inspector
} from './';


/**
 * An object that handles code inspection.
 */
export
class InspectionHandler implements IDisposable, Inspector.IInspectable {
  /**
   * Construct a new inspection handler for a widget.
   */
  constructor(rendermime: RenderMime) {
    this._rendermime = rendermime;
  }

  /**
   * A signal emitted when the handler is disposed.
   */
  disposed: ISignal<InspectionHandler, void>;

  /**
   * A signal emitted when inspector should clear all items with no history.
   */
  ephemeralCleared: ISignal<InspectionHandler, void>;

  /**
   * A signal emitted when an inspector value is generated.
   */
  inspected: ISignal<InspectionHandler, Inspector.IInspectorUpdate>;

  /**
   * The editor view used by the inspection handler.
   */
  get activeEditor(): IEditorView {
    return this._activeEditor;
  }
  set activeEditor(newValue: IEditorView) {
    if (newValue === this._activeEditor) {
      return;
    }

    if (this._activeEditor && !this._activeEditor.isDisposed) {
      const editor = this._activeEditor;
      editor.getModel().contentChanged.disconnect(this.onTextChanged, this);
    }
    this._activeEditor = newValue;
    if (this._activeEditor) {
      // Clear ephemeral inspectors in preparation for a new editor.
      this.ephemeralCleared.emit(void 0);
      const editor = this._activeEditor;
      editor.getModel().contentChanged.connect(this.onTextChanged, this);
    }
  }

  /**
   * The kernel used by the inspection handler.
   */
  get kernel(): IKernel {
    return this._kernel;
  }
  set kernel(value: IKernel) {
    this._kernel = value;
  }

  /**
   * Get whether the inspection handler is disposed.
   *
   * #### Notes
   * This is a read-only property.
   */
  get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose of the resources used by the handler.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._activeEditor = null;
    this.disposed.emit(void 0);
    clearSignalData(this);
  }

  /**
   * Update the inspector based on page outputs from the kernel.
   *
   * #### Notes
   * Payloads are deprecated and there are no official interfaces for them in
   * the kernel type definitions.
   * See [Payloads (DEPRECATED)](http://jupyter-client.readthedocs.io/en/latest/messaging.html#payloads-deprecated).
   */
  handleExecuteReply(content: KernelMessage.IExecuteOkReply): void {
    let update: Inspector.IInspectorUpdate = {
      content: null,
      type: 'details'
    };

    if (!content || !content.payload || !content.payload.length) {
      this.inspected.emit(update);
      return;
    }

    let details = content.payload.filter(i => (i as any).source === 'page')[0];
    if (details) {
      let bundle = (details as any).data as RenderMime.MimeMap<string>;
      let widget = this._rendermime.render(bundle, true);
      update.content = widget;
      this.inspected.emit(update);
      return;
    }

    this.inspected.emit(update);
  }

  /**
   * Handle a text changed signal from an editor.
   *
   * #### Notes
   * Update the hints inspector based on a text change.
   */
  protected onTextChanged(model: IEditorModel): void {
    let update: Inspector.IInspectorUpdate = {
      content: null,
      type: 'hints'
    };

    // Clear hints if the new text value is empty or kernel is unavailable.
    if (!model.getValue() || !this._kernel) {
      this.inspected.emit(update);
      return;
    }

    let contents: KernelMessage.IInspectRequest = {
      code: model.getValue(),
      cursor_pos: model.getOffsetAt(this._activeEditor.position),
      detail_level: 0
    };
    let pending = ++this._pending;

    this._kernel.inspect(contents).then(msg => {
      let value = msg.content;

      // If handler has been disposed, bail.
      if (this.isDisposed) {
        this.inspected.emit(update);
        return;
      }

      // If a newer text change has created a pending request, bail.
      if (pending !== this._pending) {
        this.inspected.emit(update);
        return;
      }

      // Hint request failures or negative results fail silently.
      if (value.status !== 'ok' || !value.found) {
        this.inspected.emit(update);
        return;
      }

      let bundle = value.data as RenderMime.MimeMap<string>;
      let widget = this._rendermime.render(bundle, true);
      update.content = widget;
      this.inspected.emit(update);
    });
  }

  private _activeEditor: IEditorView = null;
  private _isDisposed = false;
  private _kernel: IKernel = null;
  private _pending = 0;
  private _rendermime: RenderMime = null;
}


// Define the signals for the `FileBrowserModel` class.
defineSignal(InspectionHandler.prototype, 'ephemeralCleared');
defineSignal(InspectionHandler.prototype, 'disposed');
defineSignal(InspectionHandler.prototype, 'inspected');
