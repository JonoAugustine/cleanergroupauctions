export type Role = 'Member' | 'Affiliate' | string;

export type Group = {
  shortName: string;
  fullName: string;
  location: string;
  allowDonations: boolean;
  minSaleCents: number;
  role: Role;
};

export type Auction = {
  id: string;
  /** YYYY-MM-DD, MGA's local date */
  date: string | null;
  /** HH:MM, 24 hour */
  time: string | null;
  name: string;
  group: string;
  allowDonations: boolean;
  minSaleCents: number;
  role: Role;
  /** MGA only links preview and add item for upcoming auctions, so this is how CGA knows one is upcoming. */
  upcoming: boolean;
  canAddItems: boolean;
};

export type Home = { groups: Group[]; auctions: Auction[] };

export type Lot = {
  lot: string;
  lotNum: number;
  /** Free text; may contain line breaks. This is the only description bidders see. */
  title: string;
  minCents: number;
  /** Primary photo only; MGA preview shows no others. */
  imageId: string | null;
  imageSrc: string | null;
  /** Detected from the title; the preview has no donation column. */
  donation: boolean;
  /** name of the row's Print Selected checkbox in MGA's form */
  selectName: string | null;
};

export type Preview = {
  auctionId: string | null;
  lots: Lot[];
  /** From the pager ("394 items in 20 pages"); null when MGA shows no pager. */
  total: number | null;
  /** True when every lot is on this page, so no load all request is needed. */
  complete: boolean;
};

export type SellItem = {
  auctionItemId: string;
  lot: string;
  title: string;
  donated: boolean;
  minCents: number;
  imageIds: string[];
  /** Postback names of MGA's own Delete and Copy image buttons for this row. */
  deleteName: string | null;
  copyName: string | null;
};

export type Selling = { auctionId: string | null; canAdd: boolean; items: SellItem[] };

export type ItemImage = { imageId: string | null; primary: boolean; deleteName: string | null; editName: string | null };

export type ItemDialog = {
  auctionItemId: string | null;
  auctionId: string | null;
  description: string;
  minBid: string;
  minCents: number;
  isDonation: boolean;
  /** Existing items get a multipart form with an upload field; new items (id 0) do not. */
  canUpload: boolean;
  images: ItemImage[];
  /** MGA's status line, e.g. "Item successfully saved." */
  message: string;
  /** Server side validation summary, if MGA ever renders one. */
  errors: string[];
};
