import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, CheckCircle } from 'lucide-react'
import { cn } from '../lib/utils'
import { Card } from './Card'

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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-base text-gray-600">{description}</p>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "relative cursor-pointer rounded-xl border-2 border-dashed transition-all",
          "hover:border-blue-500 hover:bg-blue-50/50",
          isDragActive && "border-blue-500 bg-blue-50",
          "p-12 text-center shadow-sm hover:shadow-md"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-3">
          <div className={cn(
            "rounded-full p-4 transition-colors",
            isDragActive ? "bg-blue-100" : "bg-gray-100"
          )}>
            <Upload className={cn(
              "h-8 w-8 transition-colors",
              isDragActive ? "text-blue-600" : "text-gray-600"
            )} />
          </div>
          
          <div>
            <p className="text-lg font-semibold text-gray-900">
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              or click to select from your computer
            </p>
          </div>
          
          <div className="text-xs text-gray-500">
            Supported formats: PNG, JPG, JPEG, WebP
          </div>
        </div>
      </div>

      {/* Display uploaded files */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </p>
          <div className="space-y-2">
            {files.map((file, idx) => (
              <Card key={idx} variant="subtle" hover={false} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onRemoveFile(idx)}
                  className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
