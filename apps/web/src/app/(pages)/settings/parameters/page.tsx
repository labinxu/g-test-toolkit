import { ParametersForm } from '@/components/settings/parameters-form'
import { GlobalCacheControls } from '@/components/global-cache-controls'

export default function ParametersPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold leading-6">Directory Cache</h2>
            <p className="mt-1 text-sm text-muted-foreground">Configure cache TTL and clear cached trees.</p>
          </div>
          <GlobalCacheControls />
        </div>
      </div>
      <ParametersForm />
    </div>
  )
}
