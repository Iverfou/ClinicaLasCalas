#!/usr/bin/perl
# Minimal static file server — Windows/MINGW compatible
use strict;
use warnings;
use IO::Socket::INET;
use File::Basename;

my $PORT = $ENV{PORT} || 3000;
my $ROOT = dirname(__FILE__);
$ROOT =~ s|\\|/|g;

my %MIME = (
  html  => 'text/html; charset=utf-8',
  css   => 'text/css',
  js    => 'application/javascript; charset=utf-8',
  json  => 'application/json',
  png   => 'image/png',
  jpg   => 'image/jpeg',
  jpeg  => 'image/jpeg',
  gif   => 'image/gif',
  svg   => 'image/svg+xml',
  ico   => 'image/x-icon',
  woff  => 'font/woff',
  woff2 => 'font/woff2',
  webp  => 'image/webp',
  txt   => 'text/plain',
);

my $sock = IO::Socket::INET->new(
  LocalAddr => '0.0.0.0',
  LocalPort => $PORT,
  Proto     => 'tcp',
  Type      => SOCK_STREAM,
  ReuseAddr => 1,
  Listen    => 20,
) or die "Cannot listen on port $PORT: $@\n";

print "Server running at http://localhost:$PORT\n";
$|=1;

while (my $c = $sock->accept) {
  $c->autoflush(1);

  # Read request line + headers
  my ($req_line, $headers) = ('', '');
  while (defined(my $line = <$c>)) {
    if (!$req_line) { $req_line = $line; next; }
    last if $line =~ /^[\r\n]+$/;
  }

  my (undef, $path) = split /\s+/, $req_line;
  $path //= '/';
  $path =~ s/\?.*//;          # strip query string
  $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/ge;
  $path =~ s|\.\.||g;         # no path traversal
  $path = '/' if $path eq '';
  $path .= 'index.html' if substr($path,-1) eq '/';

  my $file = $ROOT . $path;

  if (-f $file) {
    open(my $fh, '<:raw', $file) or do { err($c,403,'Forbidden'); close $c; next };
    my $data = do { local $/; <$fh> };
    close $fh;
    my ($ext) = lc($file) =~ /\.([^.\/]+)$/;
    my $ct = $MIME{$ext // ''} // 'application/octet-stream';
    my $len = length $data;
    print $c "HTTP/1.1 200 OK\r\nContent-Type: $ct\r\nContent-Length: $len\r\n"
           . "Cache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\n"
           . "Connection: close\r\n\r\n";
    print $c $data;
  } else {
    err($c, 404, "404 Not Found: $path");
  }
  close $c;
}

sub err {
  my ($s,$code,$msg) = @_;
  my $body = "<html><body><h2>$msg</h2></body></html>";
  my $len = length $body;
  my %st = (403=>'Forbidden',404=>'Not Found',500=>'Error');
  print $s "HTTP/1.1 $code $st{$code}\r\nContent-Type: text/html\r\n"
         . "Content-Length: $len\r\nConnection: close\r\n\r\n$body";
}
