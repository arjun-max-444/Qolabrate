import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { btnSmOutline, btnSmPrimary } from "./styles";

export function useIsFollowing(targetId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["following", user?.id, targetId],
    enabled: !!user && user.id !== targetId,
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id).eq("following_id", targetId).maybeSingle();
      return !!data;
    },
  });
}

export function FollowButton({ targetId, size = "sm" }: { targetId: string; size?: "sm" }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: following = false, isLoading } = useIsFollowing(targetId);
  const key = ["following", user?.id, targetId];

  const m = useMutation({
    mutationFn: async (next: boolean) => {
      const res = next
        ? await supabase.from("follows").insert({ follower_id: user!.id, following_id: targetId })
        : await supabase.from("follows").delete().eq("follower_id", user!.id).eq("following_id", targetId);
      if (res.error) throw res.error;
    },
    onMutate: (next) => qc.setQueryData(key, next),
    onError: (_e, next) => { qc.setQueryData(key, !next); toast.error("Couldn't update follow. Try again."); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["feed", "following"] });
      qc.invalidateQueries({ queryKey: ["who-to-follow"] });
    },
  });

  if (!user || user.id === targetId) return null;
  void size;
  return (
    <button
      type="button"
      disabled={isLoading || m.isPending}
      onClick={() => m.mutate(!following)}
      aria-pressed={following}
      className={`${following ? btnSmOutline : btnSmPrimary} group min-w-[92px]`}
    >
      {following ? <><span className="group-hover:hidden">Following</span><span className="hidden group-hover:inline">Unfollow</span></> : "Follow"}
    </button>
  );
}
