import { useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3, ChevronLeft, Upload, FileText, AlertCircle, CheckCircle2,
  X, ArrowRight, Download, Settings, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import UserMenu from "@/components/UserMenu";

// ─── Types ─────────────────────────────────────────────
interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  date: string;
  rooms_available: string;
  rooms_sold: string;
  average_daily_rate: string;
  cancellations: string;
}

interface ValidationError {
  row: number;
  column: string;
  message: string;
}

interface ParsedRecord {
  date: string;
  rooms_available: number;
  rooms_sold: number;
  average_daily_rate: number;
  cancellations: number;
}

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = ["date", "rooms_available", "rooms_sold", "average_daily_rate"];
const OPTIONAL_FIELDS: (keyof ColumnMapping)[] = ["cancellations"];

// ─── CSV Parser ────────────────────────────────────────
function parseCSV(text: string): { headers: string[]; rows: CSVRow[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    if (values.length === headers.length) {
      const row: CSVRow = {};
      headers.forEach((h, idx) => { row[h] = values[idx]; });
      rows.push(row);
    }
  }

  return { headers, rows };
}

// ─── Validation ────────────────────────────────────────
function validateAndParse(
  rows: CSVRow[],
  mapping: ColumnMapping
): { records: ParsedRecord[]; errors: ValidationError[]; missingDates: string[] } {
  const errors: ValidationError[] = [];
  const records: ParsedRecord[] = [];
  const dates = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header

    // Date validation
    const dateStr = row[mapping.date];
    const dateMatch = dateStr?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      errors.push({ row: rowNum, column: "date", message: `Invalid date format "${dateStr}". Expected YYYY-MM-DD.` });
      continue;
    }
    const parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) {
      errors.push({ row: rowNum, column: "date", message: `Invalid date "${dateStr}".` });
      continue;
    }

    // Numeric validations
    const roomsAvail = parseInt(row[mapping.rooms_available]);
    const roomsSold = parseInt(row[mapping.rooms_sold]);
    const adr = parseFloat(row[mapping.average_daily_rate]);
    const cancellations = mapping.cancellations ? parseInt(row[mapping.cancellations] || "0") : 0;

    if (isNaN(roomsAvail) || roomsAvail < 0) {
      errors.push({ row: rowNum, column: "rooms_available", message: `Invalid rooms_available "${row[mapping.rooms_available]}".` });
      continue;
    }
    if (isNaN(roomsSold) || roomsSold < 0) {
      errors.push({ row: rowNum, column: "rooms_sold", message: `Invalid rooms_sold "${row[mapping.rooms_sold]}".` });
      continue;
    }
    if (roomsSold > roomsAvail) {
      errors.push({ row: rowNum, column: "rooms_sold", message: `rooms_sold (${roomsSold}) exceeds rooms_available (${roomsAvail}).` });
      continue;
    }
    if (isNaN(adr) || adr < 0) {
      errors.push({ row: rowNum, column: "average_daily_rate", message: `Invalid ADR "${row[mapping.average_daily_rate]}".` });
      continue;
    }

    dates.add(dateStr);
    records.push({
      date: dateStr,
      rooms_available: roomsAvail,
      rooms_sold: roomsSold,
      average_daily_rate: adr,
      cancellations: isNaN(cancellations) ? 0 : cancellations,
    });
  }

  // Detect missing dates in range
  const missingDates: string[] = [];
  if (records.length > 1) {
    const sortedDates = [...dates].sort();
    const start = new Date(sortedDates[0]);
    const end = new Date(sortedDates[sortedDates.length - 1]);
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      if (!dates.has(dateStr)) {
        missingDates.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }
  }

  return { records, errors: errors.slice(0, 20), missingDates: missingDates.slice(0, 10) };
}

// ─── Sample CSV Generator ──────────────────────────────
function generateSampleCSV(): string {
  const lines = ["date,rooms_available,rooms_sold,average_daily_rate,cancellations"];
  const today = new Date();
  for (let i = 90; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dow = d.getDay();
    const isWeekend = dow === 5 || dow === 6;
    const rooms = 85;
    const baseSold = isWeekend ? 68 : 55;
    const sold = Math.min(rooms, baseSold + Math.floor(Math.sin(i * 0.1) * 10));
    const baseADR = isWeekend ? 140 : 115;
    const adr = baseADR + Math.floor(Math.sin(i * 0.15) * 15);
    const cancellations = Math.max(0, Math.floor(Math.sin(i * 0.3) * 3) + 2);
    lines.push(`${dateStr},${rooms},${sold},${adr},${cancellations}`);
  }
  return lines.join("\n");
}

// ─── Step indicators ───────────────────────────────────
type Step = "upload" | "mapping" | "validation" | "complete";

function StepIndicator({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload" },
    { key: "mapping", label: "Map Columns" },
    { key: "validation", label: "Validate" },
    { key: "complete", label: "Complete" },
  ];
  const idx = steps.findIndex((s) => s.key === current);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
            i < idx ? "bg-success text-success-foreground" : i === idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
            {i < idx ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          <span className={`text-xs hidden sm:inline ${i === idx ? "font-medium" : "text-muted-foreground"}`}>{s.label}</span>
          {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────
export default function DataImport() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: "", rooms_available: "", rooms_sold: "", average_daily_rate: "", cancellations: "",
  });
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateAndParse> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-map columns by name similarity
  const autoMap = useCallback((headers: string[]) => {
    const lower = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const findMatch = (patterns: string[]): string => {
      for (const p of patterns) {
        const idx = lower.findIndex((h) => h.includes(p));
        if (idx >= 0) return headers[idx];
      }
      return "";
    };
    return {
      date: findMatch(["date", "day", "night"]),
      rooms_available: findMatch(["roomsavailable", "available", "totalrooms", "inventory"]),
      rooms_sold: findMatch(["roomssold", "sold", "occupied", "roomnight"]),
      average_daily_rate: findMatch(["averagedailyrate", "adr", "avgrate", "rate", "price"]),
      cancellations: findMatch(["cancellation", "cancel", "noshow"]),
    };
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Invalid file", description: "Please upload a .csv file", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0 || rows.length === 0) {
        toast({ title: "Empty CSV", description: "The file has no data rows.", variant: "destructive" });
        return;
      }
      setCsvHeaders(headers);
      setCsvRows(rows);
      setMapping(autoMap(headers));
      setStep("mapping");
      toast({ title: `${rows.length} rows loaded`, description: `${headers.length} columns detected` });
    };
    reader.readAsText(file);
  }, [autoMap, toast]);

  const handleValidate = useCallback(() => {
    const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
    if (missingRequired.length > 0) {
      toast({ title: "Missing mappings", description: `Map these columns: ${missingRequired.join(", ")}`, variant: "destructive" });
      return;
    }
    const result = validateAndParse(csvRows, mapping);
    setValidationResult(result);
    setStep("validation");
  }, [csvRows, mapping, toast]);

  const handleSaveToDatabase = useCallback(async () => {
    if (!validationResult || validationResult.records.length === 0) return;
    setIsSaving(true);

    // For now (before auth), store in localStorage as a pilot-ready data store
    // Once auth is added, this will be replaced with Supabase insert
    try {
      const existingData = localStorage.getItem("revpilot_historical_data");
      const existing: ParsedRecord[] = existingData ? JSON.parse(existingData) : [];
      
      // Merge: overwrite existing dates, add new ones
      const dateMap = new Map(existing.map(r => [r.date, r]));
      for (const rec of validationResult.records) {
        dateMap.set(rec.date, rec);
      }
      const merged = [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));
      localStorage.setItem("revpilot_historical_data", JSON.stringify(merged));
      
      setStep("complete");
      toast({ title: "Data imported!", description: `${validationResult.records.length} records saved. ${merged.length} total records.` });
    } catch (err) {
      toast({ title: "Save failed", description: String(err), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [validationResult, toast]);

  const handleDownloadSample = useCallback(() => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "revpilot_sample_data.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2 font-semibold">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <BarChart3 className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              RevPilot
            </div>
            <span className="hidden sm:inline text-sm text-muted-foreground">/ Data Import</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8"><Bell className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-4 w-4" /></Button>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Import Historical Data</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload your hotel's historical performance CSV to enable data-driven demand forecasting and backtesting.
          </p>
        </div>

        <StepIndicator current={step} />

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-6">
            <div className="rounded-xl border-2 border-dashed border-border bg-card p-12 text-center">
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Your CSV should contain daily records with date, rooms available, rooms sold, and average daily rate (ADR).
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <label className="cursor-pointer">
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  <Button asChild>
                    <span><FileText className="mr-2 h-4 w-4" /> Select CSV File</span>
                  </Button>
                </label>
                <Button variant="outline" onClick={handleDownloadSample}>
                  <Download className="mr-2 h-4 w-4" /> Download Sample
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium mb-3">Expected CSV Format</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Column</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Required</th>
                      <th className="px-3 py-2 text-left font-medium">Example</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-t border-border"><td className="px-3 py-2 font-medium text-foreground">date</td><td className="px-3 py-2">YYYY-MM-DD</td><td className="px-3 py-2">✓</td><td className="px-3 py-2">2025-01-15</td></tr>
                    <tr className="border-t border-border"><td className="px-3 py-2 font-medium text-foreground">rooms_available</td><td className="px-3 py-2">Integer</td><td className="px-3 py-2">✓</td><td className="px-3 py-2">85</td></tr>
                    <tr className="border-t border-border"><td className="px-3 py-2 font-medium text-foreground">rooms_sold</td><td className="px-3 py-2">Integer</td><td className="px-3 py-2">✓</td><td className="px-3 py-2">62</td></tr>
                    <tr className="border-t border-border"><td className="px-3 py-2 font-medium text-foreground">average_daily_rate</td><td className="px-3 py-2">Decimal</td><td className="px-3 py-2">✓</td><td className="px-3 py-2">125.50</td></tr>
                    <tr className="border-t border-border"><td className="px-3 py-2 font-medium text-foreground">cancellations</td><td className="px-3 py-2">Integer</td><td className="px-3 py-2">Optional</td><td className="px-3 py-2">3</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "mapping" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-medium mb-1">Map Your Columns</h3>
              <p className="text-xs text-muted-foreground mb-5">
                We auto-detected column mappings. Adjust if needed. {csvRows.length} rows loaded.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
                  <div key={field}>
                    <label className="text-xs font-medium mb-1 block">
                      {field.replace(/_/g, " ")}
                      {REQUIRED_FIELDS.includes(field) && <span className="text-destructive ml-1">*</span>}
                    </label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={mapping[field]}
                      onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
                    >
                      <option value="">— Select column —</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="mt-6">
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">Preview (first 5 rows)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {csvHeaders.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          {csvHeaders.map((h) => (
                            <td key={h} className="px-2 py-1.5 text-muted-foreground">{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={handleValidate}>Validate Data <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {/* Step 3: Validation */}
        {step === "validation" && validationResult && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <div className="text-2xl font-bold text-success">{validationResult.records.length}</div>
                <div className="text-xs text-muted-foreground mt-1">Valid Records</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <div className={`text-2xl font-bold ${validationResult.errors.length > 0 ? "text-destructive" : "text-success"}`}>
                  {validationResult.errors.length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Errors</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <div className={`text-2xl font-bold ${validationResult.missingDates.length > 0 ? "text-warning" : "text-success"}`}>
                  {validationResult.missingDates.length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Missing Dates</div>
              </div>
            </div>

            {/* Errors */}
            {validationResult.errors.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                <h3 className="text-sm font-medium text-destructive flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4" /> Validation Errors
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {validationResult.errors.map((err, i) => (
                    <div key={i} className="text-xs text-destructive/80">
                      Row {err.row}, <span className="font-medium">{err.column}</span>: {err.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing dates */}
            {validationResult.missingDates.length > 0 && (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-5">
                <h3 className="text-sm font-medium text-warning flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4" /> Missing Dates Detected
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Gaps in your data may affect forecast accuracy. Missing dates:
                </p>
                <div className="flex flex-wrap gap-1">
                  {validationResult.missingDates.map((d) => (
                    <span key={d} className="rounded bg-warning/10 px-2 py-0.5 text-xs text-warning font-medium">{d}</span>
                  ))}
                  {validationResult.missingDates.length >= 10 && (
                    <span className="text-xs text-muted-foreground">...and more</span>
                  )}
                </div>
              </div>
            )}

            {/* Data stats */}
            {validationResult.records.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-medium mb-3">Data Summary</h3>
                {(() => {
                  const recs = validationResult.records;
                  const avgOcc = recs.reduce((s, r) => s + r.rooms_sold / r.rooms_available, 0) / recs.length;
                  const avgADR = recs.reduce((s, r) => s + r.average_daily_rate, 0) / recs.length;
                  const totalRev = recs.reduce((s, r) => s + r.rooms_sold * r.average_daily_rate, 0);
                  const dates = recs.map(r => r.date).sort();
                  return (
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Date Range</div>
                        <div className="text-sm font-medium">{dates[0]} → {dates[dates.length - 1]}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Avg Occupancy</div>
                        <div className="text-sm font-medium">{(avgOcc * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Avg ADR</div>
                        <div className="text-sm font-medium">€{avgADR.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Total Revenue</div>
                        <div className="text-sm font-medium">€{totalRev.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("mapping")}>Back</Button>
              <Button
                onClick={handleSaveToDatabase}
                disabled={validationResult.records.length === 0 || isSaving}
              >
                {isSaving ? "Saving..." : `Import ${validationResult.records.length} Records`}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success mb-4" />
            <h3 className="text-xl font-bold mb-2">Import Complete!</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Your historical data has been saved. The demand model will now use this data
              for more accurate forecasting and backtesting.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/dashboard">
                <Button>Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
              <Button variant="outline" onClick={() => { setStep("upload"); setCsvHeaders([]); setCsvRows([]); setValidationResult(null); }}>
                Import More Data
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
