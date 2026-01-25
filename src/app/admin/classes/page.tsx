"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Plus,
  Loader2,
  Calendar,
  Clock,
  Users,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  CalendarIcon,
  Upload,
  X,
  Image as ImageIcon,
} from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ClassSession } from "@/types";

const classFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  startsAt: z.date({ required_error: "Please select a date" }),
  startsAtTime: z.string({ required_error: "Please select a time" }),
  duration: z.coerce.number().min(15, "Duration must be at least 15 minutes"),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
  pricePaise: z.coerce.number().min(0, "Price must be 0 or more"),
});

type ClassFormData = z.infer<typeof classFormSchema>;

// Image upload component
const ImageUpload = ({
  value,
  onChange,
  onRemove,
  isUploading,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  onRemove: () => void;
  isUploading: boolean;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const response = await adminApi.uploadImage(base64, file.name, "classes");
        if (response.success && response.data?.url) {
          onChange(response.data.url);
        }
      } catch (error) {
        console.error("Upload error:", error);
        alert("Failed to upload image. Please try again.");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        {value ? (
          <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
            <Image
              src={value}
              alt="Class image"
              fill
              className="object-cover"
            />
            <button
              type="button"
              onClick={onRemove}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-gray-50 transition-colors"
          >
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500">Click to upload</span>
              </>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Max 5MB. Recommended: 800x600px
      </p>
    </div>
  );
};

const formatPrice = (paise: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(paise / 100);
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

export default function AdminClassesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSession | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: () => adminApi.listClasses(),
  });

  const form = useForm<ClassFormData>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      title: "",
      description: "",
      duration: 60,
      capacity: 10,
      pricePaise: 50000, // ₹500
      startsAtTime: "10:00",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<ClassSession, "id" | "createdAt" | "updatedAt" | "spotsBooked">) =>
      adminApi.createClass(data),
    onSuccess: () => {
      toast({ title: "Class created successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create class", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClassSession> }) =>
      adminApi.updateClass(id, data),
    onSuccess: () => {
      toast({ title: "Class updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
      setIsDialogOpen(false);
      setEditingClass(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update class", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminApi.updateClass(id, { active }),
    onSuccess: () => {
      toast({ title: "Class status updated" });
      queryClient.invalidateQueries({ queryKey: ["admin", "classes"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update status", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: ClassFormData) => {
    const [hours, minutes] = data.startsAtTime.split(":").map(Number);
    const startsAt = new Date(data.startsAt);
    startsAt.setHours(hours, minutes, 0, 0);

    const classData = {
      title: data.title,
      description: data.description || null,
      imageUrl: imageUrl,
      startsAt: startsAt.toISOString(),
      duration: data.duration,
      capacity: data.capacity,
      pricePaise: data.pricePaise * 100, // Convert to paise
      active: true,
    };

    if (editingClass) {
      updateMutation.mutate({ id: editingClass.id, data: classData });
    } else {
      createMutation.mutate(classData as any);
    }
  };

  const handleEdit = (classItem: ClassSession) => {
    setEditingClass(classItem);
    setImageUrl(classItem.imageUrl || null);
    const startsAt = new Date(classItem.startsAt);
    form.reset({
      title: classItem.title,
      description: classItem.description || "",
      startsAt: startsAt,
      startsAtTime: `${startsAt.getHours().toString().padStart(2, "0")}:${startsAt.getMinutes().toString().padStart(2, "0")}`,
      duration: classItem.duration,
      capacity: classItem.capacity,
      pricePaise: classItem.pricePaise / 100, // Convert from paise
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingClass(null);
    setImageUrl(null);
    form.reset();
  };

  const classes = data?.data || [];
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Classes</h1>
          <p className="text-muted-foreground">
            Manage class sessions and workshops
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingClass(null); setImageUrl(null); form.reset(); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Class
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingClass ? "Edit Class" : "Add New Class"}</DialogTitle>
              <DialogDescription>
                {editingClass ? "Update class details" : "Create a new class session"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Yoga for Beginners" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the class..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Image Upload */}
                <div>
                  <FormLabel>Class Image</FormLabel>
                  <div className="mt-2">
                    <ImageUpload
                      value={imageUrl}
                      onChange={(url) => {
                        setIsUploading(false);
                        setImageUrl(url);
                      }}
                      onRemove={() => setImageUrl(null)}
                      isUploading={isUploading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startsAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(field.value, "PPP") : "Pick date"}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="startsAtTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (mins)</FormLabel>
                        <FormControl>
                          <Input type="number" min="15" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacity</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pricePaise"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={handleDialogClose}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : editingClass ? (
                      "Update Class"
                    ) : (
                      "Create Class"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-16 text-destructive">
              Failed to load classes. Please try again.
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              No classes found. Create your first class!
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map((classItem) => (
                  <TableRow key={classItem.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {classItem.imageUrl ? (
                          <div className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
                            <Image
                              src={classItem.imageUrl}
                              alt={classItem.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{classItem.title}</p>
                          {classItem.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {classItem.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateTime(classItem.startsAt)}
                    </TableCell>
                    <TableCell>{classItem.duration} mins</TableCell>
                    <TableCell>
                      {classItem.spotsBooked}/{classItem.capacity}
                    </TableCell>
                    <TableCell>{formatPrice(classItem.pricePaise)}</TableCell>
                    <TableCell>
                      <Badge variant={classItem.active ? "default" : "secondary"}>
                        {classItem.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: classItem.id,
                              active: !classItem.active,
                            })
                          }
                          title={classItem.active ? "Deactivate" : "Activate"}
                        >
                          {classItem.active ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(classItem)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
