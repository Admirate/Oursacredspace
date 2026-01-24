"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/api";
import type { SpaceRequest } from "@/types";

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const getStatusBadge = (status: string) => {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string; icon?: React.ReactNode; label: string }> = {
    REQUESTED: { variant: "outline", className: "border-orange-500 text-orange-600", icon: <AlertCircle className="h-3 w-3 mr-1" />, label: "Pending" },
    APPROVED_CALL_SCHEDULED: { variant: "default", className: "bg-blue-500", icon: <CheckCircle2 className="h-3 w-3 mr-1" />, label: "Approved" },
    RESCHEDULE_REQUESTED: { variant: "outline", className: "border-yellow-500 text-yellow-600", icon: <AlertCircle className="h-3 w-3 mr-1" />, label: "Reschedule" },
    DECLINED: { variant: "destructive", icon: <XCircle className="h-3 w-3 mr-1" />, label: "Declined" },
    CONFIRMED: { variant: "default", className: "bg-green-500", icon: <CheckCircle2 className="h-3 w-3 mr-1" />, label: "Confirmed" },
    NOT_PROCEEDING: { variant: "secondary", icon: <XCircle className="h-3 w-3 mr-1" />, label: "Cancelled" },
    FOLLOW_UP_REQUIRED: { variant: "outline", className: "border-purple-500 text-purple-600", icon: <AlertCircle className="h-3 w-3 mr-1" />, label: "Follow Up" },
  };
  const c = config[status] || { variant: "outline" as const, label: status };
  return (
    <Badge variant={c.variant} className={c.className}>
      {c.icon}
      {c.label}
    </Badge>
  );
};

export default function AdminSpacePage() {
  const [selectedRequest, setSelectedRequest] = useState<SpaceRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "decline" | "confirm" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "spaceRequests"],
    queryFn: () => adminApi.listSpaceRequests(),
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: string; status: string; adminNotes?: string }) =>
      adminApi.updateSpaceRequest({
        requestId: params.id,
        status: params.status as any,
        adminNotes: params.adminNotes,
      }),
    onSuccess: (_, variables) => {
      toast({
        title: `Request ${variables.status.toLowerCase()}`,
        description: "Space request has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "spaceRequests"] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAction = (request: SpaceRequest, action: "approve" | "decline" | "confirm") => {
    setSelectedRequest(request);
    setActionType(action);
    setAdminNotes("");
  };

  const handleCloseDialog = () => {
    setSelectedRequest(null);
    setActionType(null);
    setAdminNotes("");
  };

  const handleConfirmAction = () => {
    if (!selectedRequest || !actionType) return;

    const statusMap = {
      approve: "APPROVED",
      decline: "DECLINED",
      confirm: "CONFIRMED",
    };

    updateMutation.mutate({
      id: selectedRequest.id,
      status: statusMap[actionType],
      adminNotes: adminNotes || undefined,
    });
  };

  const requests = data?.data || [];
  const pendingRequests = requests.filter((r) => r.status === "REQUESTED");
  const approvedRequests = requests.filter((r) => r.status === "APPROVED_CALL_SCHEDULED");
  const otherRequests = requests.filter((r) => !["REQUESTED", "APPROVED_CALL_SCHEDULED"].includes(r.status));

  const RequestCard = ({ request }: { request: SpaceRequest }) => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {request.booking?.customerName || "Unknown Customer"}
            </CardTitle>
            <CardDescription>
              Submitted {formatDateTime(request.createdAt)}
            </CardDescription>
          </div>
          {getStatusBadge(request.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contact Info */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            {request.booking?.customerEmail}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            {request.booking?.customerPhone}
          </div>
        </div>

        <Separator />

        {/* Request Details */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium">Preferred Date</span>
            </div>
            <p className="text-sm pl-6">{formatDate(request.preferredDate)}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-medium">Duration</span>
            </div>
            <p className="text-sm pl-6">{request.duration} hour(s)</p>
          </div>
        </div>

        {request.attendees && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium">Expected Attendees</span>
            </div>
            <p className="text-sm pl-6">{request.attendees} people</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="font-medium">Purpose</span>
          </div>
          <p className="text-sm pl-6 text-muted-foreground">{request.purpose}</p>
        </div>

        {request.specialRequirements && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Special Requirements</span>
            <p className="text-sm text-muted-foreground">{request.specialRequirements}</p>
          </div>
        )}

        {request.adminNotes && (
          <div className="bg-muted rounded-lg p-3">
            <span className="text-sm font-medium">Admin Notes</span>
            <p className="text-sm text-muted-foreground mt-1">{request.adminNotes}</p>
          </div>
        )}

        {/* Action Buttons */}
        {request.status === "REQUESTED" && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleAction(request, "decline")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Decline
            </Button>
            <Button className="flex-1" onClick={() => handleAction(request, "approve")}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>
        )}

        {request.status === "APPROVED_CALL_SCHEDULED" && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleAction(request, "decline")}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleAction(request, "confirm")}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm Payment
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Space Requests</h1>
        <p className="text-muted-foreground">
          Review and manage space booking requests
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{pendingRequests.length}</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{approvedRequests.length}</div>
            <p className="text-sm text-muted-foreground">Awaiting Payment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {requests.filter((r) => r.status === "CONFIRMED").length}
            </div>
            <p className="text-sm text-muted-foreground">Confirmed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({approvedRequests.length})
          </TabsTrigger>
          <TabsTrigger value="all">All Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                No pending requests
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : approvedRequests.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                No approved requests awaiting payment
              </CardContent>
            </Card>
          ) : (
            approvedRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                No space requests yet
              </CardContent>
            </Card>
          ) : (
            requests.map((request) => <RequestCard key={request.id} request={request} />)
          )}
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "Approve Request"}
              {actionType === "decline" && "Decline Request"}
              {actionType === "confirm" && "Confirm Payment Received"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" &&
                "The customer will be notified and asked to make payment."}
              {actionType === "decline" &&
                "The customer will be notified that their request was declined."}
              {actionType === "confirm" &&
                "Mark this booking as paid and confirmed."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Notes for customer (optional)
              </label>
              <Textarea
                placeholder={
                  actionType === "approve"
                    ? "E.g., Please pay within 24 hours to confirm..."
                    : actionType === "decline"
                    ? "E.g., Unfortunately the space is not available on this date..."
                    : "E.g., Payment received via UPI..."
                }
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={updateMutation.isPending}
              variant={actionType === "decline" ? "destructive" : "default"}
              className={actionType === "confirm" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {actionType === "approve" && "Approve"}
              {actionType === "decline" && "Decline"}
              {actionType === "confirm" && "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
