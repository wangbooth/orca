import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExternalLink } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { getDefaultSettings } from '../../../../shared/constants'
import { FileExplorerRowContextMenu } from './file-explorer-row-context-menu'
import { fileNode } from './file-explorer-tree-node-test-fixtures'
import type { TreeNode } from './file-explorer-types'

type ItemProps = { onSelect?: () => void; children?: React.ReactNode }

const { capturedItems, toastErrorMock } = vi.hoisted(() => {
  const capturedItems: ItemProps[] = []
  return { capturedItems, toastErrorMock: vi.fn() }
})

vi.mock('sonner', () => ({ toast: { error: toastErrorMock } }))

vi.mock('@/components/ui/context-menu', async () => {
  const React_ = await import('react')
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React_.createElement(React_.Fragment, null, children)

  return {
    ContextMenuContent: passthrough,
    ContextMenuItem: (props: ItemProps) => {
      capturedItems.push(props)
      return React_.createElement(React_.Fragment, null, props.children)
    },
    ContextMenuSeparator: () => null,
    ContextMenuShortcut: passthrough
  }
})

function selectReveal(operationOwner: TreeNode['operationOwner']): void {
  renderToStaticMarkup(
    <FileExplorerRowContextMenu
      node={{ ...fileNode, operationOwner }}
      isExpanded={false}
      deleteShortcutLabel="Delete"
      canOpenInOrcaBrowser={false}
      canCollapseFolderSubtree={false}
      targetDir="/repo/src"
      targetDepth={1}
      selectionSize={1}
      onViewFile={vi.fn()}
      onCopyPaths={vi.fn()}
      onStartNew={vi.fn()}
      onStartRename={vi.fn()}
      onDuplicate={vi.fn()}
      onAddFolderAsProject={vi.fn()}
      canAddAsProject={false}
      onOpenInTerminal={vi.fn()}
      onRequestDelete={vi.fn()}
      onCollapseFolderSubtree={vi.fn()}
      onFindInFolder={vi.fn()}
    />
  )
  // Why: the label is platform-specific; the icon identifies the reveal item everywhere.
  const revealItem = capturedItems.find((item) =>
    React.Children.toArray(item.children).some(
      (child) => React.isValidElement(child) && child.type === ExternalLink
    )
  )
  expect(revealItem).toBeDefined()
  revealItem?.onSelect?.()
}

describe('FileExplorerRowContextMenu reveal', () => {
  const openPath = vi.fn()

  beforeEach(() => {
    capturedItems.splice(0)
    toastErrorMock.mockReset()
    openPath.mockReset()
    // Why: a globally focused remote runtime used to block reveal for local rows too.
    useAppStore.setState({
      settings: { ...getDefaultSettings('/tmp'), activeRuntimeEnvironmentId: 'env-1' }
    })
    vi.stubGlobal('window', { api: { shell: { openPath } } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reveals a locally listed file while a remote runtime is focused', () => {
    selectReveal({ kind: 'local' })

    expect(openPath).toHaveBeenCalledWith(fileNode.path)
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  const nonLocalOwners: [string, TreeNode['operationOwner']][] = [
    ['runtime', { kind: 'runtime', environmentId: 'env-1', executionHostId: 'runtime:env-1' }],
    ['ssh', { kind: 'ssh', connectionId: 'ssh-1' }],
    ['unstamped', undefined]
  ]

  it.each(nonLocalOwners)('blocks reveal for a %s row', (_label, operationOwner) => {
    selectReveal(operationOwner)

    expect(openPath).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
  })
})
