import React, { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertTriangle,
  CheckCircle,
  Lock,
  Users,
  FileText,
  BarChart3,
  Shield,
  Clock,
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useQueryClient } from '@tanstack/react-query';

/**
 * PHASE 12 - Security & Compliance Dashboard
 * Role Management, Audit Logging, Compliance Monitoring
 */

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isBuiltIn: boolean;
}

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  status: 'success' | 'failure' | 'denied';
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
  userId: string;
}

interface ComplianceEvent {
  id: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  resourceType: string;
  resolved: boolean;
}

export function SecurityCompliancePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('roles');
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showAuditDetail, setShowAuditDetail] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  // Queries
  const { data: roles = [] } = trpc.compliance.getRoles.useQuery();
  const { data: permissions = [] } = trpc.compliance.getPermissions.useQuery();
  const { data: auditLogs } = trpc.compliance.getAuditLogs.useQuery({
    limit: 20,
  });
  const { data: complianceEvents = [] } = trpc.compliance.getUnresolvedEvents.useQuery();

  // Mutations
  const createRoleMutation = trpc.compliance.createRole.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance', 'getRoles'] });
      setShowCreateRole(false);
      setRoleFormData({ name: '', description: '', permissions: [] });
    },
  });

  const resolveEventMutation = trpc.compliance.resolveComplianceEvent.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance', 'getUnresolvedEvents'] });
    },
  });

  const generateReportMutation = trpc.compliance.generateComplianceReport.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance', 'getComplianceReport'] });
    },
  });

  // Group permissions by category
  const permissionsByCategory = useMemo(() => {
    const grouped: Record<string, typeof permissions> = {};
    permissions.forEach((p) => {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    });
    return grouped;
  }, [permissions]);

  const handleCreateRole = async () => {
    if (!roleFormData.name || roleFormData.permissions.length === 0) return;

    await createRoleMutation.mutateAsync({
      name: roleFormData.name,
      description: roleFormData.description,
      permissions: roleFormData.permissions,
    });
  };

  const togglePermission = (permissionId: string) => {
    setRoleFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((p) => p !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'destructive',
      high: 'destructive',
      medium: 'warning',
      low: 'secondary',
      warning: 'warning',
      info: 'default',
    };
    return colors[severity] || 'default';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (status === 'denied') return <AlertTriangle className="w-4 h-4 text-red-600" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Security & Compliance</h1>
        <p className="text-gray-600">Manage roles, audit logs, and compliance policies</p>
      </div>

      {/* Critical Events Alert */}
      {complianceEvents.some((e) => e.severity === 'critical') && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {complianceEvents.filter((e) => e.severity === 'critical').length} critical compliance
            events require immediate attention
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        {/* ============================================================ */}
        {/* ROLES TAB */}
        {/* ============================================================ */}
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Role Management</CardTitle>
                  <CardDescription>Create and manage organization roles</CardDescription>
                </div>
                <Button
                  onClick={() => setShowCreateRole(true)}
                  className="gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Create Role
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {roles.map((role: Role) => (
                  <div
                    key={role.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{role.name}</h3>
                          {role.isBuiltIn && (
                            <Badge variant="secondary">Built-in</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{role.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {role.permissions?.map((perm: string) => (
                        <Badge key={perm} variant="outline" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* AUDIT LOGS TAB */}
        {/* ============================================================ */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>Complete action trail and access history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs?.logs?.map((log: AuditLog) => (
                      <TableRow
                        key={log.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedAuditLog(log);
                          setShowAuditDetail(true);
                        }}
                      >
                        <TableCell className="font-medium text-gray-900">
                          {log.action}
                        </TableCell>
                        <TableCell className="text-gray-600">{log.resource}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(log.status)}
                            <span className="capitalize text-sm">{log.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSeverityColor(log.severity) as any}>
                            {log.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-gray-600 text-sm">{log.userId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* COMPLIANCE TAB */}
        {/* ============================================================ */}
        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Events</CardTitle>
              <CardDescription>Security incidents and policy violations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {complianceEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No unresolved compliance events</p>
                  </div>
                ) : (
                  complianceEvents.map((event: ComplianceEvent) => (
                    <div
                      key={event.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">
                              {event.eventType}
                            </h4>
                            <Badge variant={getSeverityColor(event.severity) as any}>
                              {event.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{event.description}</p>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            resolveEventMutation.mutateAsync({ eventId: event.id })
                          }
                        >
                          Resolve
                        </Button>
                      </div>

                      <div className="text-xs text-gray-500">
                        {event.resourceType} • {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================ */}
        {/* REPORTS TAB */}
        {/* ============================================================ */}
        <TabsContent value="reports">
          <div className="grid gap-6">
            {/* Generate Report Card */}
            <Card>
              <CardHeader>
                <CardTitle>Generate Compliance Report</CardTitle>
                <CardDescription>Create compliance audit report</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {(['daily', 'weekly', 'monthly', 'annual'] as const).map((type) => (
                    <Button
                      key={type}
                      variant="outline"
                      className="h-20 capitalize"
                      onClick={() => {
                        const now = new Date();
                        const startDate =
                          type === 'daily'
                            ? new Date(now.setDate(now.getDate() - 1))
                            : type === 'weekly'
                              ? new Date(now.setDate(now.getDate() - 7))
                              : type === 'monthly'
                                ? new Date(now.setMonth(now.getMonth() - 1))
                                : new Date(now.setFullYear(now.getFullYear() - 1));

                        generateReportMutation.mutateAsync({
                          reportType: type,
                          startDate,
                          endDate: new Date(),
                        });
                      }}
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      {type} Report
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Compliance Frameworks */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Frameworks</CardTitle>
                <CardDescription>Verify compliance with industry standards</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {(['SOC2', 'HIPAA', 'GDPR', 'PCI_DSS', 'ISO27001'] as const).map(
                    (framework) => (
                      <div key={framework} className="border rounded-lg p-3 text-center">
                        <p className="font-semibold text-sm text-gray-900 mb-2">
                          {framework}
                        </p>
                        <Button size="sm" variant="outline" className="w-full">
                          Check Status
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ============================================================ */}
      {/* CREATE ROLE DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showCreateRole} onOpenChange={setShowCreateRole}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Role Name */}
            <div>
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                placeholder="e.g., Content Manager"
                value={roleFormData.name}
                onChange={(e) =>
                  setRoleFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="mt-1"
              />
            </div>

            {/* Role Description */}
            <div>
              <Label htmlFor="roleDesc">Description</Label>
              <Input
                id="roleDesc"
                placeholder="Describe the purpose of this role"
                value={roleFormData.description}
                onChange={(e) =>
                  setRoleFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                className="mt-1"
              />
            </div>

            {/* Permissions Selection */}
            <div>
              <Label>Permissions</Label>
              <div className="border rounded-lg p-3 max-h-64 overflow-y-auto space-y-3 mt-2">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category}>
                    <h4 className="font-semibold text-sm text-gray-900 mb-2 capitalize">
                      {category}
                    </h4>
                    <div className="space-y-2 ml-2">
                      {perms.map((perm: any) => (
                        <div key={perm.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={perm.id}
                            checked={roleFormData.permissions.includes(perm.id)}
                            onCheckedChange={() => togglePermission(perm.id)}
                          />
                          <Label
                            htmlFor={perm.id}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {perm.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowCreateRole(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateRole}
                disabled={createRoleMutation.isPending}
              >
                Create Role
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* AUDIT LOG DETAIL DIALOG */}
      {/* ============================================================ */}
      <Dialog open={showAuditDetail} onOpenChange={setShowAuditDetail}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>

          {selectedAuditLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Action</p>
                  <p className="font-semibold text-gray-900">{selectedAuditLog.action}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Resource</p>
                  <p className="font-semibold text-gray-900">{selectedAuditLog.resource}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <Badge variant={getSeverityColor(selectedAuditLog.status) as any}>
                    {selectedAuditLog.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Severity</p>
                  <Badge variant={getSeverityColor(selectedAuditLog.severity) as any}>
                    {selectedAuditLog.severity}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Timestamp</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(selectedAuditLog.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SecurityCompliancePage;
