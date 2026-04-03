import React, { useState, useMemo } from 'react';
import { trpc } from '../utils/trpc';
import { Plus, Filter, Search, ChevronDown, Code2, Shield } from 'lucide-react';
import { useAuth } from '../_core/hooks/useAuth';

export const SecurityPage: React.FC = () => {
  const { user } = useAuth();
  const [severityFilter, setSeverityFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScan, setSelectedScan] = useState<number | null>(null);
  const [showFixPanel, setShowFixPanel] = useState(false);
  const [selectedVuln, setSelectedVuln] = useState<any>(null);

  // FINAL FIX 1: Replace all mocks with real tRPC
  const { data: scanData, isLoading: scansLoading } = trpc.scan.list.useQuery({ workspaceId: user?.activeWorkspaceId! }, { enabled: !!user?.activeWorkspaceId });
  const { data: vulnData, isLoading: vulnsLoading } = trpc.security.getVulnerabilities.useQuery({ workspaceId: user?.activeWorkspaceId! }, { enabled: !!scanData });
  const updateStatus = trpc.security.updateVulnerabilityStatus.useMutation();

  const filteredVulns = useMemo(() => {
    if (!vulnData?.vulnerabilities) return [];
    return vulnData.vulnerabilities.filter((v: any) => {
      const matchesSeverity = severityFilter === 'All' || v.severity === severityFilter;
      const matchesSearch = v.endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           v.type.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSeverity && matchesSearch;
    });
  }, [vulnData, severityFilter, searchTerm]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'medium':
        return 'bg-amber-100 text-amber-700';
      case 'low':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'text-red-600';
      case 'In Progress':
        return 'text-blue-600';
      case 'Resolved':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const handleMarkResolved = () => {
    if (selectedVuln) {
      updateStatus.mutate({ vulnId: selectedVuln.id, status: 'Resolved' }, {
        onSuccess: () => {
          setShowFixPanel(false);
          setSelectedVuln(null);
        },
      });
    }
  };

  // FINAL FIX 1: Loading skeletons
  if (scansLoading) {
    return (
      <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
  }

  // FINAL FIX 1: Empty state when no scans exist
  if (!scanData?.scans || scanData.scans.length === 0) {
    return (
      <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Security Scanning</h1>
            <p className="text-gray-500">Discover and track API vulnerabilities.</p>
          </div>
          <button className="px-6 py-3 bg-[#1d4ed8] text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center gap-2">
            <Plus className="w-5 h-5" />
            New Scan
          </button>
        </div>

        <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center space-y-6">
          <Shield className="w-16 h-16 text-gray-300 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No scans yet</h2>
            <p className="text-gray-500">Import a Postman collection to start scanning for vulnerabilities.</p>
          </div>
          <button className="px-6 py-3 bg-[#1d4ed8] text-white rounded-lg font-bold hover:bg-blue-700 transition-all inline-flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Import Postman Collection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Security Scanning</h1>
          <p className="text-gray-500">Discover and track API vulnerabilities.</p>
        </div>
        <button className="px-6 py-3 bg-[#1d4ed8] text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center gap-2">
          <Plus className="w-5 h-5" />
          New Scan
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* FINAL FIX 1: Filter bar */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search endpoints or vulnerabilities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
              />
            </div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
            >
              <option>All</option>
              <option>critical</option>
              <option>high</option>
              <option>medium</option>
              <option>low</option>
            </select>
          </div>

          {/* FINAL FIX 1: Vulnerability results table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Endpoint</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Method</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Vulnerability</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Severity</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">PCI DSS</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Fix</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vulnsLoading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">Loading vulnerabilities...</td>
                    </tr>
                  ) : filteredVulns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500">No vulnerabilities found</td>
                    </tr>
                  ) : (
                    filteredVulns.map((vuln: any) => (
                      <tr key={vuln.id} className="border-b border-gray-100 hover:bg-gray-50 transition-all">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{vuln.endpoint}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-bold text-xs">
                            {vuln.method}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{vuln.type}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getSeverityColor(vuln.severity)}`}>
                            {vuln.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">DSS 6.5.1</td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => {
                              setSelectedVuln(vuln);
                              setShowFixPanel(true);
                            }}
                            className="text-[#1d4ed8] font-bold hover:underline"
                          >
                            View Fix
                          </button>
                        </td>
                        <td className={`px-6 py-4 text-sm font-bold ${getStatusColor(vuln.status || 'Open')}`}>
                          {vuln.status || 'Open'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FINAL FIX 1: Scan history sidebar */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Scan History</h3>
          <div className="space-y-3">
            {scanData?.scans.map((scan: any) => (
              <button
                key={scan.id}
                onClick={() => setSelectedScan(scan.id)}
                className={`w-full p-4 rounded-lg border transition-all text-left ${
                  selectedScan === scan.id
                    ? 'bg-blue-50 border-[#1d4ed8]'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-bold text-gray-900">
                  {new Date(scan.createdAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">{scan.scannedEndpoints} endpoints</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    scan.vulnerabilitiesFound > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {scan.vulnerabilitiesFound} Critical
                  </span>
                  <span className="text-xs text-gray-500">{scan.status}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FINAL FIX 1: Fix panel slide-over */}
      {showFixPanel && selectedVuln && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Fix Details</h2>
              <button
                onClick={() => setShowFixPanel(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase">Vulnerability</p>
                <p className="text-lg font-bold text-gray-900">{selectedVuln.type}</p>
              </div>

              <div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getSeverityColor(selectedVuln.severity)}`}>
                  {selectedVuln.severity}
                </span>
              </div>

              <div>
                <p className="text-sm font-bold text-gray-500 uppercase">What it is</p>
                <p className="text-gray-700">{selectedVuln.description || 'No description available'}</p>
              </div>

              <div>
                <p className="text-sm font-bold text-gray-500 uppercase mb-2">How to fix it</p>
                <div className="bg-gray-900 p-4 rounded-lg overflow-x-auto">
                  <code className="text-green-400 font-mono text-sm">{selectedVuln.recommendations?.[0] || 'No remediation available'}</code>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-gray-500 uppercase">PCI DSS Requirement</p>
                <p className="text-gray-700">DSS 6.5.1 — Injection Flaws</p>
              </div>

              <button
                onClick={() => navigator.clipboard.writeText(selectedVuln.recommendations?.[0] || '')}
                className="w-full px-4 py-2 bg-[#1d4ed8] text-white rounded-lg font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <Code2 className="w-5 h-5" />
                Copy Code
              </button>

              <button
                onClick={handleMarkResolved}
                disabled={updateStatus.isPending}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all disabled:opacity-50"
              >
                {updateStatus.isPending ? 'Marking...' : 'Mark as Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
