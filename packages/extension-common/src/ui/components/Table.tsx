type Props = {
  className?: string;
  children: React.ReactNode;
};

function Table({ className, children }: Props) {
  return (
    <table className={className}>
      <tbody>{children}</tbody>
    </table>
  );
}

export default Table;
