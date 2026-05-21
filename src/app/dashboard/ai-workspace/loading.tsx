import { SkeletonBar, SkeletonCard } from '@/components/skeletons'

export default function AiWorkspaceLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-4 sm:px-6 py-6 sm:py-10">
      <div className="w-full max-w-3xl text-center mb-10">
        <SkeletonBar className="h-8 w-56 mx-auto mb-3" />
        <SkeletonBar className="h-4 w-80 max-w-full mx-auto mb-6" />
        <SkeletonBar className="h-14 w-full rounded-[var(--radius-xl)]" />
      </div>
      <div className="w-full max-w-4xl">
        <SkeletonBar className="h-4 w-48 mx-auto mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}
