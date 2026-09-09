import { twMerge } from "tailwind-merge";

type Props = {
  className?: string;
  header: React.ReactNode;
  data: React.ReactNode;
};

function TableRow({ className, header, data }: Props) {
  return (
    <tr className={twMerge("text-xs w-full", className)}>
      <th
        className={
          "whitespace-normal text-left min-w-40 pr-5 py-1 text-gray-600 font-normal"
        }
      >
        {header}
      </th>
      <td className="py-1 break-all">{data}</td>
    </tr>
  );
}

export default TableRow;
