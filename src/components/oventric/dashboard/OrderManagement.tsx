import { useServerFn } from "@tanstack/react-start";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listMySales } from "@/lib/fulfilment.functions";
import { SalesFulfilmentList } from "@/components/oventric/SalesFulfilmentList";
import { Loader2, ShoppingCart } from "lucide-react";

export function OrderManagement() {
  const fetchSales = useServerFn(listMySales);

  const { data: sales, refetch } = useSuspenseQuery({
    queryKey: ["my-sales"],
    queryFn: () => fetchSales({}),
  });

  if (!sales) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-1">Sales & Fulfilment</h3>
        <p className="text-sm text-slate-500">Manage orders and track delivery status.</p>
      </div>

      <SalesFulfilmentList 
        rows={sales} 
        onChanged={() => refetch()} 
      />

      {sales.length === 0 && (
        <div className="py-12 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl">
          <ShoppingCart className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No sales yet</p>
          <p className="text-xs text-slate-500 mt-1">Orders from customers will appear here.</p>
        </div>
      )}
    </div>
  );
}
