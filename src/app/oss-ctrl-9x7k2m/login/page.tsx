"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Lock, Mail, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { adminApi } from "@/lib/api";
import { getAssetUrl } from "@/lib/assets";
import { ADMIN_ROUTE_PREFIX } from "@/lib/constants";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await adminApi.login(data.email, data.password);
      
      if (response.success) {
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });
        router.push(ADMIN_ROUTE_PREFIX);
      } else {
        setError(response.error || "Invalid credentials");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-sacred-cream p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sacred-green/5 via-transparent to-sacred-pink/5 pointer-events-none" />

      <Card className="w-full max-w-md relative border-0 shadow-xl shadow-sacred-green/5">
        <div className="h-1.5 bg-gradient-to-r from-sacred-green via-sacred-burgundy to-sacred-green rounded-t-xl" />

        <CardContent className="pt-8 pb-8 px-8">
          <div className="flex flex-col items-center mb-8">
            <img
              src={getAssetUrl("brand/logo.png")}
              alt="Our Sacred Space"
              className="h-16 w-auto object-contain mb-5"
            />
            <h1 className="text-2xl font-semibold text-sacred-burgundy">
              Admin Portal
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to manage Our Sacred Space
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sacred-green/60" />
                        <Input
                          type="email"
                          placeholder=""
                          autoComplete="off"
                          className="pl-10 border-gray-200 focus-visible:ring-sacred-green/30 focus-visible:border-sacred-green"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sacred-green/60" />
                        <Input
                          type="password"
                          placeholder=""
                          autoComplete="off"
                          className="pl-10 border-gray-200 focus-visible:ring-sacred-green/30 focus-visible:border-sacred-green"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-sacred-green hover:bg-sacred-green-dark text-white font-medium py-5 transition-all duration-200 hover:shadow-lg hover:shadow-sacred-green/20"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Contact the system administrator if you need access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
