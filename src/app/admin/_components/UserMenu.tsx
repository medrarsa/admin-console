export default function UserMenu() {
  return (
    <div className="px-4 py-3 border-b border-white/10">
      <div className="flex items-center gap-3">
        <img
          className="h-10 w-10 rounded-full bg-white/10"
          src="https://cdn.salla.sa/Azrxzp/4uiYHPtMtTcEEFby6FaiRwtxdSAN7CBVVF5AqQlL.png"
          alt=""
        />
        <div className="flex-1">
          <div className="font-bold text-sm">مدرار قطع غيار</div>
          <div className="text-xs text-white/70">باقة: برو</div>
        </div>
        <a
          href="#"
          className="text-xs bg-white/10 px-3 py-1 rounded-full hover:bg-white/15"
        >
          زيارة المتجر
        </a>
      </div>
    </div>
  );
}
