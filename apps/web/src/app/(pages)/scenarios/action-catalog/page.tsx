'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { normalizeResponseError, isUnauthorizedError } from '@/lib/error'
import { PageListPanel } from './components/page-list-panel'
import { PageDetailsSheet } from './components/page-details-sheet'
import { ViewPageDialog } from './components/view-page-dialog'
import { useActionCatalogModel } from './use-action-catalog'
import type { PageSummary } from './types'

export default function ActionCatalogSettingsPage() {
  const router = useRouter()
  const vm = useActionCatalogModel()

  const handleOpenLib = useCallback(
    (page: PageSummary) => {
      const libPath = vm.getLibFilePathForPage({
        platform: page.platform,
        key: page.key,
        className: page.className,
      })
      if (!libPath) {
        toast.error('当前平台未配置 libDir，无法定位对应 libs 文件')
        return
      }
      try {
        localStorage.setItem('gtt:libs:lastFile', libPath)
      } catch {}
      router.push('/testcases/libs')
    },
    [router, vm]
  )

  const handleUploadWebIds = useCallback(
    async (file: File) => {
      vm.setUploadingWebIds(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('platform', vm.platform || 'gettr-web')
        const res = await fetch('/api/action-catalog/web-ids/upload', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const err = await normalizeResponseError(res as any)
          throw new Error(err.message || '导入页面元素 ID 失败')
        }
        const data = (await res.json()) as {
          pagesCreated?: number
          elementsCreated?: number
          elementsUpdated?: number
        }
        const created = data?.elementsCreated ?? 0
        const updated = data?.elementsUpdated ?? 0
        const pagesCreated = data?.pagesCreated ?? 0
        toast.success(
          `导入完成：新建页面 ${pagesCreated} 个，新增元素 ${created} 个，更新元素 ${updated} 个`
        )
        await vm.loadPages(vm.platform)
      } catch (e: any) {
        toast.error(e?.message || '导入页面元素 ID 失败')
      } finally {
        vm.setUploadingWebIds(false)
      }
    },
    [vm]
  )

  const handleClearWebIds = useCallback(async () => {
    const confirmed = window.confirm(
      `确认删除平台 ${vm.platform} 下所有已导入的页面元素 ID？不会删除页面和动作。`
    )
    if (!confirmed) return
    vm.setClearingWebIds(true)
    try {
      const qs = new URLSearchParams()
      if (vm.platform) qs.set('platform', vm.platform)
      const res = await fetch(`/api/action-catalog/web-ids?${qs.toString()}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await normalizeResponseError(res as any)
        throw new Error(err.message || '清空页面元素 ID 失败')
      }
      const data = (await res.json()) as { deleted?: number }
      toast.success(`已删除当前平台下的元素 ID 共 ${data?.deleted ?? 0} 个；可重新导入 CSV。`)
      await vm.loadPages(vm.platform)
    } catch (e: any) {
      toast.error(e?.message || '清空页面元素 ID 失败')
    } finally {
      vm.setClearingWebIds(false)
    }
  }, [vm])

  const handleBulkDelete = useCallback(async () => {
    if (!vm.selectedPageIds.length) return
    const targets = vm.pages.filter((p) => vm.selectedPageIds.includes(p.id))
    if (!targets.length) return
    const confirmed = window.confirm(
      `确认删除选中的 ${targets.length} 个页面？将同时删除其所有动作。`
    )
    if (!confirmed) return
    try {
      vm.setDeleting(true)
      for (const page of targets) {
        const res = await fetch(`/api/action-catalog/pages/${page.id}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          const err = await normalizeResponseError(res as any)
          throw new Error(err.message || '删除页面失败')
        }
      }
      await vm.loadPages(vm.platform)
      vm.setSelectedPageId(null)
      vm.setSelectedPageIds([])
      vm.setDraft(null)
      toast.success(`已删除选中的 ${targets.length} 个页面`)
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        try {
          router.push('/signin')
        } catch {}
      } else {
        toast.error(e?.message || '删除页面失败')
      }
    } finally {
      vm.setDeleting(false)
    }
  }, [vm, router])

  const handleRefreshDetail = useCallback(() => {
    if (vm.selectedPageId != null) {
      void vm.loadPageDetail(vm.selectedPageId)
    }
  }, [vm])

  return (
    <div className="flex min-h-0 flex-1 flex-row gap-2 p-2">
      <PageListPanel
        platform={vm.platform}
        platforms={vm.platforms}
        onPlatformChange={(val) => {
          vm.setPlatform(val)
          vm.setSelectedPageId(null)
          vm.setDraft(null)
          vm.setPageTablePage(1)
        }}
        onCreatePlatform={vm.handleCreatePlatform}
        onDeletePlatform={vm.handleDeletePlatform}
        uploadingWebIds={vm.uploadingWebIds}
        onUploadWebIds={handleUploadWebIds}
        clearingWebIds={vm.clearingWebIds}
        onClearWebIds={handleClearWebIds}
        totalElements={vm.totalElements}
        filteredPages={vm.filteredPages}
        pagedPages={vm.pagedPages}
        selectedPageIds={vm.selectedPageIds}
        setSelectedPageIds={vm.setSelectedPageIds}
        loadingPages={vm.loadingPages}
        deleting={vm.deleting}
        onCreatePage={vm.handleCreatePage}
        onBulkDelete={handleBulkDelete}
        onSelectPage={vm.setSelectedPageId}
        onOpenDetails={(id) => {
          vm.setSelectedPageId(id)
          vm.setDetailsOpen(true)
        }}
        onOpenLib={handleOpenLib}
        onViewPage={(id) => void vm.handleViewPage(id)}
        onDeletePage={(page) => void vm.handleDeletePage(page)}
        keyFilter={vm.keyFilter}
        setKeyFilter={vm.setKeyFilter}
        nameFilter={vm.nameFilter}
        setNameFilter={vm.setNameFilter}
        enabledFilter={vm.enabledFilter}
        setEnabledFilter={vm.setEnabledFilter}
        pageTablePage={vm.pageTablePage}
        pageTableTotalPages={vm.pageTableTotalPages}
        pageTablePageSize={vm.pageTablePageSize}
        setPageTablePage={vm.setPageTablePage}
        setPageTablePageSize={vm.setPageTablePageSize}
      />

      <PageDetailsSheet
        open={vm.detailsOpen}
        onOpenChange={vm.setDetailsOpen}
        draft={vm.draft}
        setDraft={vm.setDraft}
        jumpActionKey={vm.pendingOpenActionKey}
        onJumpActionKeyConsumed={() => vm.setPendingOpenActionKey(null)}
        saving={vm.saving}
        deleting={vm.deleting}
        loadingDetail={vm.loadingDetail}
        onRefresh={handleRefreshDetail}
        onSave={() => void vm.handleSave()}
        onSaveAction={(action) => void vm.handleSaveAction(action)}
        onDelete={() => void vm.handleDelete()}
        onUpdateAction={vm.handleUpdateAction}
        onDeleteAction={vm.handleDeleteAction}
        onAddParam={vm.handleAddParam}
        onUpdateParam={vm.handleUpdateParam}
        onDeleteParam={vm.handleDeleteParam}
        pages={vm.pages}
        callSourcePageId={vm.callSourcePageId}
        setCallSourcePageId={vm.setCallSourcePageId}
        callSourceActionsByPageId={vm.callSourceActionsByPageId}
        loadCallSourceActions={vm.loadCallSourceActions}
        loadingCallSource={vm.loadingCallSource}
      />

      <ViewPageDialog
        open={vm.viewPageDialogOpen}
        onOpenChange={(open) => {
          vm.setViewPageDialogOpen(open)
          if (!open) {
            vm.setViewPageDetail?.(null)
          }
        }}
        loading={vm.viewPageLoading}
        detail={vm.viewPageDetail}
      />
    </div>
  )
}
