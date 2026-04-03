// @ts-nocheck
'use client';

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { AlertCircle, Plus, Edit, Trash2, Users } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description: string;
  isBuiltin: boolean;
  permissionCount: number;
  createdAt: Date;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

export function RoleManagementPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  // Fetch roles
  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      // Replace with actual API call
      const response = await fetch('/api/compliance/roles');
      const data = await response.json();
      setRoles(data.roles || []);
      setError(null);
    } catch (err) {
      setError('Failed to load roles');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    try {
      if (!formData.name.trim()) {
        setError('Role name is required');
        return;
      }

      // Replace with actual API call
      const response = await fetch('/api/compliance/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to create role');

      setShowCreateDialog(false);
      setFormData({ name: '', description: '', permissions: [] });
      await fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    }
  };

  const handleEditRole = async () => {
    try {
      if (!selectedRole) return;

      // Replace with actual API call
      const response = await fetch(`/api/compliance/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update role');

      setShowEditDialog(false);
      setFormData({ name: '', description: '', permissions: [] });
      await fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      // Replace with actual API call
      const response = await fetch(`/api/compliance/roles/${roleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete role');

      await fetchRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  const openEditDialog = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description,
      permissions: [],
    });
    setShowEditDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-gray-600">Manage roles and permissions</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Create a new custom role with specific permissions
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Role Name</label>
                <Input
                  placeholder="e.g., Content Manager"
                  value={formData.name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="Role description"
                  value={formData.description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateRole}>Create Role</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update the role details and permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Role Name</label>
              <Input
                placeholder="Role name"
                value={formData.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                disabled={selectedRole?.isBuiltin}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="Role description"
                value={formData.description}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditRole} disabled={selectedRole?.isBuiltin}>
                {selectedRole?.isBuiltin ? 'Cannot Edit Built-in Role' : 'Update Role'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Roles ({roles.length})</CardTitle>
          <CardDescription>
            Manage system roles and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No roles found. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {role.description}
                    </TableCell>
                    <TableCell>
                      {role.isBuiltin ? (
                        <Badge variant="default">Built-in</Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {role.permissionCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(role.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(role)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {!role.isBuiltin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => handleDeleteRole(role.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{roles.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Built-in Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {roles.filter((r) => r.isBuiltin).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {roles.filter((r) => !r.isBuiltin).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Details Section */}
      {selectedRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {selectedRole.name} Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Description</p>
                <p className="font-medium">{selectedRole.description}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="font-medium">
                  {selectedRole.isBuiltin ? 'Built-in' : 'Custom'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Permissions</p>
                <p className="font-medium">{selectedRole.permissionCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="font-medium">
                  {new Date(selectedRole.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default RoleManagementPage;
