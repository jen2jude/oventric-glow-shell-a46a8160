import { useIsAppShell } from "@/hooks/use-launch-context";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Star, Send, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { getProductRating, rateProduct, type ProductReview } from "@/lib/product-reviews.functions";
import { AvatarImage } from "@/components/oventric/AvatarImage";
import { COUNTRY_META } from "@/lib/currency/africa";
import { supabase } from "@/integrations/supabase/client";

export function ProductComments({ productId }: { productId: string }) {
  const isAppShell = useIsAppShell();
  const { require } = useOnboarding();
  const fetchRating = useServerFn(getProductRating);
  const submitReview = useServerFn(rateProduct);
  
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [newComment, setNewComment] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      if (!cancelled) setUserId(uid);
      
      try {
        const r = await fetchRating({ data: { productId, userId: uid } });
        if (!cancelled) {
          setReviews(r.reviews);
          setAverage(r.average);
          setCount(r.count);
          setMyRating(r.myRating);
        }
      } catch (e) {
        console.error("Failed to load reviews", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId, fetchRating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    require(1, async () => {
      setSubmitting(true);
      try {
        const r = await submitReview({ 
          data: { productId, rating, comment: newComment } 
        });
        setReviews(r.reviews);
        setAverage(r.average);
        setCount(r.count);
        setMyRating(r.myRating);
        setNewComment("");
        toast.success("Review posted successfully!");
      } catch (err: any) {
        toast.error(err.message || "Failed to post review");
      } finally {
        setSubmitting(false);
      }
    }, "buyer");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className={`${isAppShell ? "mt-12" : "mt-0"} space-y-8 pb-12`}>
      <div className={`flex items-center justify-between border-b ${isAppShell ? "border-white/10" : "border-slate-200"} pb-4`}>
        <h2 className={`text-xl font-bold ${isAppShell ? "text-white" : "text-slate-900"} flex items-center gap-2`}>
          <MessageSquare className="w-5 h-5" />
          Customer Reviews ({count})
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex text-amber-400">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star 
                key={s} 
                className={`w-4 h-4 ${s <= Math.round(average) ? 'fill-current' : ''}`} 
              />
            ))}
          </div>
          <span className={`text-lg font-bold ${isAppShell ? "text-white" : "text-slate-900"}`}>{average.toFixed(1)}</span>
        </div>
      </div>

      {/* Write a review */}
      <div className={`${isAppShell ? "bg-[#16161A] border-white/5" : "bg-white border-slate-200 shadow-sm"} md:bg-white md:shadow-sm border rounded-xl p-6`}>
        <h3 className={`text-sm font-bold uppercase tracking-wider ${isAppShell ? "text-slate-400" : "text-slate-500"} mb-4`}>
          {myRating ? "Update your review" : "Write a review"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                className={`p-1 transition-transform hover:scale-110 ${s <= rating ? "text-amber-400" : isAppShell ? "text-slate-600" : "text-slate-300"}`}
              >
                <Star className={`w-6 h-6 ${s <= rating ? 'fill-current' : ''}`} />
              </button>
            ))}
            <span className={`ml-2 text-xs ${isAppShell ? "text-slate-400" : "text-slate-500"}`}>
              {rating === 5 ? "Excellent" : rating === 4 ? "Very Good" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}
            </span>
          </div>
          
          <div className="relative">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Tell others what you think about this product and the seller..."
              className={`w-full ${isAppShell ? "bg-black/20 border-white/5 text-white" : "bg-slate-50 border-slate-200 text-slate-900"} md:bg-slate-50 border md:border-slate-200 rounded-lg p-4 text-sm focus:ring-2 focus:ring-emerald-500 min-h-[100px] resize-none`}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-lg disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {myRating ? "Update Review" : "Post Review"}
          </button>
        </form>
      </div>

      {/* Review list */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No reviews yet. Be the first to share your experience!
          </div>
        ) : (
          reviews.map((rev) => (
            <div 
              key={rev.id} 
              className={`${isAppShell ? "bg-[#16161A] border-white/5" : "bg-white border-slate-200 shadow-sm"} md:bg-white md:shadow-sm border rounded-xl p-5`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full overflow-hidden ${isAppShell ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"}`}>
                    <AvatarImage src={rev.user.avatarUrl} alt={rev.user.fullName || "User"} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${isAppShell ? "text-white" : "text-slate-900"}`}>
                        {rev.user.fullName || "Anonymous User"}
                      </span>
                      {rev.user.country && COUNTRY_META[rev.user.country] && (
                        <span className="text-sm" title={COUNTRY_META[rev.user.country].name}>
                          {COUNTRY_META[rev.user.country].flag}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 md:text-slate-400">
                      {format(new Date(rev.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star 
                      key={s} 
                      className={`w-3 h-3 ${s <= rev.rating ? 'fill-current' : ''}`} 
                    />
                  ))}
                </div>
              </div>
              <p className={`text-sm ${isAppShell ? "text-slate-300" : "text-slate-600"} leading-relaxed whitespace-pre-wrap`}>
                {rev.comment}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
