import fs from 'fs'
import path from 'path'
import ReactMarkdown from 'react-markdown'

export default function ChartOfAccountsPage() {
  const filePath = path.join(process.cwd(), 'src/data/CHART_OF_ACCOUNTS_STANDARDS.md')
  const fileContent = fs.readFileSync(filePath, 'utf8')

  return (
    <div className="prose prose-slate max-w-5xl mx-auto p-8 bg-white rounded-xl shadow-sm">
      <ReactMarkdown>{fileContent}</ReactMarkdown>
    </div>
  )
}
