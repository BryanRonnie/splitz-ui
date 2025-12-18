import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X } from 'lucide-react'
import { cn } from '../lib/utils'

interface FileDropzoneProps {
  onFilesAccepted: (files: File[]) => void
  files: File[]
  onRemoveFile: (index: number) => void
  multiple?: boolean
  title: string
  description: string
  accept?: Record<string, string[]>
}

export default function FileDropzone({
  onFilesAccepted,
  files,
  onRemoveFile,
  multiple = false,
  title,
  description,
  accept = { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }
}: FileDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFilesAccepted(acceptedFiles)
  }, [onFilesAccepted])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    accept
  })

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "relative cursor-pointer rounded-lg border-2 border-dashed transition-colors",
          "hover:border-primary/50 hover:bg-accent/50",
          isDragActive && "border-primary bg-accent",
          "p-8 text-center"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-2">
          <div className={cn(
            "rounded-full p-3",
            isDragActive ? "bg-primary/10" : "bg-muted"
          )}>
            <Upload className={cn(
              "h-6 w-6",
              isDragActive ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isDragActive ? "Drop files here" : "Drag & drop or click to upload"}
            </p>
            <p className="text-xs text-muted-foreground">
              {multiple ? "PNG, JPG or WEBP (multiple)" : "PNG, JPG or WEBP (single file)"}
            </p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-md border bg-card p-3"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-10 w-10 flex-shrink-0 rounded bg-muted flex items-center justify-center">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="ml-2 flex-shrink-0 rounded-full p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
