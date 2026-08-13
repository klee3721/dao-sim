import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: class {},
  WebContentsView: class {},
  session: {}
}))

import { BrowserManager } from './browser-manager'

interface MutableBrowserManager {
  activeView: unknown
  activeSiteId: string | null
  attachViewEvents(view: unknown, siteId: 'khosim'): void
}

function setActiveView(manager: BrowserManager, view: unknown): void {
  const mutable = manager as unknown as MutableBrowserManager
  mutable.activeView = view
  mutable.activeSiteId = 'khosim'
}

describe('BrowserManager lifecycle cleanup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('detaches and closes an active view exactly once', () => {
    const removeChildView = vi.fn()
    const close = vi.fn()
    const window = {
      isDestroyed: () => false,
      contentView: { removeChildView }
    }
    const view = {
      webContents: { isDestroyed: () => false, close }
    }
    const manager = new BrowserManager(window as never)
    setActiveView(manager, view)

    manager.dispose()
    manager.dispose()

    expect(removeChildView).toHaveBeenCalledTimes(1)
    expect(removeChildView).toHaveBeenCalledWith(view)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not access the parent contentView after the window is destroyed', () => {
    const contentView = vi.fn(() => {
      throw new TypeError('Object has been destroyed')
    })
    const window = {
      isDestroyed: () => true,
      get contentView() {
        return contentView()
      }
    }
    const view = {
      get webContents() {
        throw new TypeError('Object has been destroyed')
      }
    }
    const manager = new BrowserManager(window as never)
    setActiveView(manager, view)

    expect(() => manager.dispose()).not.toThrow()
    expect(contentView).not.toHaveBeenCalled()
  })

  it('ignores only Electron destroyed-object races during cleanup', () => {
    const window = {
      isDestroyed: () => false,
      contentView: {
        removeChildView: () => {
          throw new TypeError('Object has been destroyed')
        }
      }
    }
    const manager = new BrowserManager(window as never)
    setActiveView(manager, {
      webContents: { isDestroyed: () => true, close: vi.fn() }
    })

    expect(() => manager.dispose()).not.toThrow()
  })

  it('does not hide unrelated cleanup errors', () => {
    const window = {
      isDestroyed: () => false,
      contentView: {
        removeChildView: () => {
          throw new TypeError('unexpected cleanup failure')
        }
      }
    }
    const manager = new BrowserManager(window as never)
    setActiveView(manager, {
      webContents: { isDestroyed: () => true, close: vi.fn() }
    })

    expect(() => manager.dispose()).toThrow('unexpected cleanup failure')
  })

  it('ignores a pending navigation failure after the manager is disposed', async () => {
    let rejectLoad: (error: Error) => void = () => undefined
    const loadURL = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectLoad = reject
        })
    )
    const close = vi.fn()
    const window = {
      isDestroyed: () => false,
      contentView: { removeChildView: vi.fn() }
    }
    const view = {
      webContents: {
        isDestroyed: () => false,
        loadURL,
        close
      }
    }
    const manager = new BrowserManager(window as never)
    setActiveView(manager, view)

    const navigation = manager.navigate('https://khosim.com/sim-gia-re')
    manager.dispose()
    rejectLoad(new TypeError('Object has been destroyed'))

    await expect(navigation).resolves.toBeUndefined()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not touch window bounds or create a new view after disposal', async () => {
    const getContentBounds = vi.fn(() => ({ width: 1200, height: 800 }))
    const window = {
      isDestroyed: () => false,
      getContentBounds,
      contentView: { removeChildView: vi.fn() }
    }
    const manager = new BrowserManager(window as never)

    manager.dispose()
    manager.setBounds({ x: 0, y: 0, width: 900, height: 600 })

    expect(getContentBounds).not.toHaveBeenCalled()
    await expect(manager.openSite('khosim')).resolves.toBeUndefined()
  })

  it('forwards only valid Huyền Số results from the active browser view', () => {
    const send = vi.fn()
    const window = {
      isDestroyed: () => false,
      webContents: { send },
      contentView: { removeChildView: vi.fn() }
    }
    const webContents = Object.assign(new EventEmitter(), {
      isDestroyed: () => false,
      setWindowOpenHandler: vi.fn()
    })
    const view = { webContents }
    const manager = new BrowserManager(window as never)
    setActiveView(manager, view)
    ;(manager as unknown as MutableBrowserManager).attachViewEvents(view, 'khosim')

    webContents.emit('ipc-message', {}, 'huyen-so:selection-result', { kind: 'success' })
    expect(send).not.toHaveBeenCalled()

    const result = {
      kind: 'success',
      originalInput: '0849768786',
      normalizedInput: '0849768786',
      selectionLabel: 'Số điện thoại',
      summary: 'Kết quả mẫu',
      pairs: [],
      energies: [],
      catCount: 0,
      hungCount: 0,
      warnings: [],
      quickCodes: [],
      transitions: []
    }
    webContents.emit('ipc-message', {}, 'huyen-so:selection-result', result)

    expect(send).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith('huyen-so:result', result)
  })
})
